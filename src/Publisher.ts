import { createChannelObservable } from './ChannelManager.js';
import { ConnectionManager } from './ConnectionManager.js';
import { TimeoutError } from './TimeoutError.js';
import amqplib from 'amqplib';
import { Channel } from 'amqplib';
import { IllegalOperationError } from 'amqplib/lib/error.js';
import { EventEmitter } from 'events';
import { mergeMap, map, retry } from 'rxjs';

type PublishingOptions = Omit<amqplib.Options.Publish, 'persistent'>;
export interface Publisher {
	/**
	 * Publishes the given message, and returns a promise that indicates when the message is received
	 * by RabbitMQ.
	 * @param msg The message to send
	 * @param options Message publishing options, like header data or expiration time
	 * @param timeout Amount of time to wait for the server to acknowledge having received the message.
	 *                Note, that if the promise is rejected by a timeout error. It may still get received.
	 *                Default timeout is no timeout.
	 */
	(msg: Buffer, options?: PublishingOptions, timeout?: number): Promise<void>;

	closePublisher(): void;
}

const TIMEOUT = -1;

export interface PublisherOptions {
	maximumInMemoryQueueSize?: number;
	persistent?: boolean;
	queueName: string;
}

function timer(millis: number): Promise<typeof TIMEOUT> {
	return new Promise<typeof TIMEOUT>((resolve) => {
		setTimeout(() => {
			resolve(TIMEOUT);
		}, millis);
	});
}

function waitFor(eventEmitter: EventEmitter, _: string): Promise<void> {
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
	const maximumInMemoryQueueSize = publisherOptions.maximumInMemoryQueueSize ?? 100;
	let resolvePromise: (channel: amqplib.Channel) => void;
	let done = false;
	let channelPromise: Promise<amqplib.Channel>;
	const newPromise = () => {
		channelPromise = new Promise<amqplib.Channel>((resolve) => {
			resolvePromise = resolve;
		});
	};
	newPromise();
	const subscription = createChannelObservable(connectionManager, connectionOpened, connectionClosed)
		.pipe(
			retry({
				delay: (errors) => {
					return errors.pipe(
						map(() => {
							newPromise();
							return null;
						}),
					);
				},
			}),
			mergeMap(async (ch: Channel) => {
				try {
					await ch.checkQueue(publisherOptions.queueName);

					return ch;
				} catch (e) {
					// eslint-disable-next-line no-console
					console.error(e);
					process.exit(1);
				}
			}),
		)
		.subscribe({
			error: (e: Error) => {
				// eslint-disable-next-line no-console
				console.error('Unknown error');
				// eslint-disable-next-line no-console
				console.error(e.stack);
				process.exit(1);
			},
			next: (channel: amqplib.Channel) => {
				resolvePromise(channel);
			},
		});
	let deliveringMessages = false;

	const deliver = async () => {
		deliveringMessages = true;

		while (messages.length > 0 && !done) {
			const [msg] = messages.splice(0, 1);
			const channel = await channelPromise;
			try {
				const success = channel.sendToQueue(publisherOptions.queueName, msg[0], {
					...msg[1],
					persistent: publisherOptions.persistent ?? true,
				});
				if (!success) {
					messages.unshift(msg);
					await waitFor(channel, 'drain');
				} else {
					msg[2]();
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
	const messages: [Buffer, PublishingOptions, () => void, (err: Error) => void, boolean][] = [];
	const publish = async (msg: Buffer, options: PublishingOptions = {}, timeout?: number): Promise<void> => {
		if (messages.length === maximumInMemoryQueueSize) {
			throw new Error('Maxixmum in memory queue size exceeded');
		}
		if (done) {
			throw new Error('Already closed');
		}
		let entry: [Buffer, PublishingOptions, () => void, (err: Error) => void, boolean] = null as any;
		const promise = new Promise<void>((resolve, reject) => {
			entry = [msg, options, resolve, reject, true];
			messages.push(entry);
		});

		if (!deliveringMessages) {
			deliver().catch((e: unknown) => {
				// eslint-disable-next-line no-console
				console.error(e);
				process.exit(1);
			});
		}

		if (timeout) {
			const timeoutPromise = timer(timeout);

			const winner = await Promise.race([promise, timeoutPromise]);
			if (winner === TIMEOUT) {
				const idx = messages.indexOf(entry);
				const err = new TimeoutError(`Message timed out after ${timeout} milliseconds`);
				if (idx >= 0) {
					entry[3](err);
					messages.splice(idx, 1);
				}
				throw err;
			}
			return;
		}
		return promise;
	};

	(publish as Publisher).closePublisher = () => {
		done = true;
		subscription.unsubscribe();
	};

	return publish as Publisher;
}
