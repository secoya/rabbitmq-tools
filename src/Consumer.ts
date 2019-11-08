import * as amqplib from 'amqplib';
import * as RxJS from 'rxjs';
import { ConnectionClosedError } from './ConnectionClosedError';
import { ConnectionManager } from './ConnectionManager';

export interface ConsumerOptions {
	prefetch?: number;
	queueName: string;
}

type OnCloseCallback = (cb: () => void) => void;

export interface Message {
	/**
	 * The message received from RabbitMQ.
	 */
	message: amqplib.Message;
	/**
	 * Ack's the message.
	 * @param allUpTo Whether or not to ack all the messages not ack'd prior to this one (including this message).
	 *                Default is false.
	 */
	ack(allUpTo?: boolean): void;
	/**
	 * Nack's the message.
	 * @param requeue Whether or not to requeue the message. Default is true.
	 * @param allUpTo Whether or not to nack all messages not ack'd prior to this one (including this message).
	 *                Default is false.
	 */
	nack(requeue?: boolean, allUpTo?: boolean): void;
}

async function createConsumer(
	connectionManager: ConnectionManager,
	consumerOptions: ConsumerOptions,
	connectionOpened: () => void,
	connectionClosed: () => void,
	subscriber: RxJS.Subscriber<Message>,
	onClose: OnCloseCallback,
): Promise<void> {
	let connection: amqplib.Connection | null = null;
	let channel: amqplib.Channel | null = null;
	let connected = false;
	let consumerTag: string | null = null;
	let cancelChannel = true;
	const teardown = () => {
		let closeConnection = true;
		const onConnectionClosed = () => {
			if (connected) {
				connectionClosed();
			}
		};
		if (consumerTag != null && channel != null && connected && cancelChannel) {
			channel
				.cancel(consumerTag)
				.then(onConnectionClosed)
				.catch(e => {
					// tslint:disable-next-line:no-console
					console.error('Unhooking consumer error', e);
					process.exit(1);
				});
			closeConnection = false;
		}
		if (channel != null) {
			channel.removeListener('error', onChannelError);
			channel.removeListener('close', onChannelClose);
		}
		channel = null;
		if (connection != null) {
			connection.removeListener('error', onError);
			connection.removeListener('close', onClosed);
		}
		if (closeConnection) {
			onConnectionClosed();
		}
	};
	const onError = (err: Error) => {
		cancelChannel = false;
		subscriber.error(err);
		teardown();
	};
	const onChannelError = (err: Error) => {
		cancelChannel = false;
		subscriber.error(err);
		teardown();
	};
	const onClosed = (err?: Error) => {
		cancelChannel = false;
		if (err) {
			subscriber.error(new ConnectionClosedError('The underlying connection was closed.', err));
		} else {
			subscriber.complete();
		}
		teardown();
	};
	const onChannelClose = (_: Error) => {
		cancelChannel = false;
		teardown();
	};

	try {
		connection = await connectionManager.getConnection();
		connected = true;
		connectionOpened();
	} catch (e) {
		subscriber.error(e);
		teardown();
		return;
	}

	connection.on('error', onError);
	connection.on('close', onClosed);

	try {
		channel = await connection.createChannel();
	} catch (e) {
		subscriber.error(e);
		teardown();
		return;
	}
	const ch = channel;
	ch.on('error', onChannelError);
	ch.on('closed', onChannelClose);

	const onMessage = (msg: amqplib.Message) => {
		subscriber.next({
			ack(allUpTo?: boolean) {
				if (channel != null) {
					ch.ack(msg);
				}
			},
			nack(requeue?: boolean, allUpTo?: boolean) {
				if (channel != null) {
					ch.nack(msg, allUpTo, requeue);
				}
			},
			message: msg,
		});
	};

	try {
		await channel.checkQueue(consumerOptions.queueName);
		await channel.prefetch(consumerOptions.prefetch || 1); // Not global, ie. per consumer
		consumerTag = (await channel.consume(consumerOptions.queueName, onMessage, {
			noAck: false,
		})).consumerTag;
	} catch (e) {
		subscriber.error(e);
		teardown();
		return;
	}

	onClose(() => {
		teardown();
	});
}

export function consumeQueue(
	connectionManager: ConnectionManager,
	connectionOpened: () => void,
	connectionClosed: () => void,
	consumerOptions: ConsumerOptions,
): RxJS.Observable<Message> {
	return new RxJS.Observable<Message>(subscriber => {
		let closed = false;
		let closeCallback: (() => void) | null = null;
		const onClose: OnCloseCallback = cb => {
			if (closed) {
				cb();
			} else {
				closeCallback = cb;
			}
		};
		createConsumer(
			connectionManager,
			consumerOptions,
			connectionOpened,
			connectionClosed,
			subscriber,
			onClose,
		).catch((e: Error) => {
			// tslint:disable-next-line:no-console
			console.error('Create consumer error', e.stack);
			process.exit(1);
		});

		return () => {
			closed = true;
			if (closeCallback != null) {
				closeCallback();
			}
		};
	});
}
