import * as amqplib from 'amqplib';
import { IllegalOperationError } from 'amqplib/lib/error';
import { EventEmitter } from 'events';
import { Observable } from 'rxjs';
import { createChannelObservable } from './ChannelManager';
import { ConnectionManager } from './ConnectionManager';
import { TimeoutError } from './TimeoutError';
export interface Publisher {
	/**
	 * Publishes the given message, and returns a promise that indicates when the message is received
	 * by RabbitMQ.
	 * @param msg The message to send
	 * @param timeout Amount of time to wait for the server to acknowledge having received the message.
	 *                Note, that if the promise is rejected by a timeout error. It may still get received.
	 *                Default timeout is no timeout.
	 */
	(msg: Buffer, timeout?: number): Promise<void>;

	closePublisher(): void;
}

const TIMEOUT = -1;

export interface PublisherOptions {
	queueName: string;
	persistent?: boolean;
	maximumInMemoryQueueSize?: number;
}

function timer(millis: number): Promise<typeof TIMEOUT> {
	return new Promise<typeof TIMEOUT>((resolve, reject) => {
		setTimeout(() => resolve(TIMEOUT), millis);
	});
}

function waitFor(eventEmitter: EventEmitter, eventName: string): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const onError = (err: Error) => {
			eventEmitter.removeListener('drain', onSuccess);
			reject(err);
		};
		const onSuccess = () => {
			eventEmitter.removeListener('error', onError);
			resolve();
		};
		eventEmitter.once('drain', onSuccess);
		eventEmitter.once('error', onError);
	});
}

export function createPublisher(
	connectionManager: ConnectionManager,
	connectionOpened: () => void,
	connectionClosed: () => void,
	publisherOptions: PublisherOptions,
): Publisher {
	const maximumInMemoryQueueSize = publisherOptions.maximumInMemoryQueueSize || 100;
	let resolvePromise: (channel: amqplib.Channel) => void;
	let rejectPromise: (err: Error) => void;
	let done = false;
	let channelPromise: Promise<amqplib.Channel>;
	const newPromise = () => {
		channelPromise = new Promise<amqplib.Channel>((resolve, reject) => {
			resolvePromise = resolve;
			rejectPromise = reject;
		});
	};
	newPromise();
	const subscription = createChannelObservable(
		connectionManager,
		connectionOpened,
		connectionClosed,
	).retryWhen((errors) => {
		return errors.map(e => {
			newPromise();
			return null;
		});
	}).flatMap(async ch => {
		try {
			await ch.checkQueue(publisherOptions.queueName);

			return ch;
		} catch (e) {
			console.error(e);
			process.exit(1);
		}
	}).subscribe({
		error: (e: Error) => {
			console.error('Unknown error');
			console.error(e.stack);
			process.exit(1);
		},
		next: (channel: amqplib.Channel) => {
			resolvePromise(channel);
		},
	});
	const maxSize = publisherOptions.maximumInMemoryQueueSize || 100;
	let deliveringMessages = false;

	const deliver = async () => {
		deliveringMessages = true;

		while (messages.length > 0 && !done) {
			const [msg] = messages.splice(0, 1);
			const channel = await channelPromise;
			try {
				const success = channel.sendToQueue(publisherOptions.queueName, msg[0], {
					persistent: publisherOptions.persistent != null ? publisherOptions.persistent : true,
				});
				if (!success) {
					messages.unshift(msg);
					await waitFor(channel, 'drain');
				} else {
					msg[1]();
				}
			} catch (e) {
				if (!(e instanceof IllegalOperationError)) {
					throw e;
				}
				messages.unshift(msg);
			}
		}
		deliveringMessages = false;
	};
	const messages: [Buffer, () => void, (err: Error) => void, boolean][] = [];
	const publish = async (msg: Buffer, timeout?: number, removeOnTimeout = false): Promise<void> => {
		if (messages.length === maximumInMemoryQueueSize) {
			throw new Error('Maxixmum in memory queue size exceeded');
		}
		if (done) {
			throw new Error('Already closed');
		}
		let entry: [Buffer, () => void, (err: Error) => void, boolean] = null as any;
		const promise = new Promise<void>((resolve, reject) => {
			entry = [msg, resolve, reject, true];
			messages.push(entry);
		});

		if (!deliveringMessages) {
			deliver().catch((e: Error) => {
				console.error(e);
				process.exit(1);
			});
		}

		if (timeout) {
			const timeoutPromise = timer(timeout);

			const winner = await Promise.race([promise, timeoutPromise]);
			if (winner === TIMEOUT) {
				const idx = messages.indexOf(entry);
				const err = new TimeoutError('Message timed out after ' + timeout + ' milliseconds');
				if (idx >= 0) {
					entry[2](err);
					messages.splice(idx, 1);
				}
				throw err;
			}
			return;
		}
	};

	(publish as Publisher).closePublisher = () => {
		done = true;
		subscription.unsubscribe();
	};

	return publish as Publisher;
}
