import * as amqplib from 'amqplib';
import { Observable } from 'rxjs';
import { ConnectionClosedError } from './ConnectionClosedError.js';
import { ConnectionManager } from './ConnectionManager.js';

export function createChannelObservable(
	connectionManager: ConnectionManager,
	connectionOpened: () => void,
	connectionClosed: () => void,
): Observable<amqplib.Channel> {
	return new Observable((subscriber) => {
		let isCleanupHandlersCalled = false;
		const onClose = (err?: Error) => {
			if (!isCleanupHandlersCalled) {
				cleanupLogic.forEach((v) => v());
				isCleanupHandlersCalled = true;
			}
			if (err) {
				subscriber.error(err);
			} else {
				subscriber.complete();
			}
		};
		const cleanupLogic: (() => void)[] = [];
		const createChannel = async () => {
			try {
				const conn = await connectionManager.getConnection();
				connectionOpened();
				cleanupLogic.push(connectionClosed);
				const onConnectionClose = (err?: Error) => {
					if (err != null) {
						onClose(new ConnectionClosedError('The underlying connection was closed.', err));
					} else {
						onClose();
					}
				};
				const onConnectionError = (err: Error) => {
					onClose(err);
				};
				// Channels can close without error before the connection errors.
				// So we schedule the channel closing after potential errors arrive.
				let channelClosedImmediate: any = null;
				const onChannelClose = (err?: Error) => {
					channelClosedImmediate = setImmediate(() => onClose(err));
				};
				conn.on('close', onConnectionClose);
				cleanupLogic.push(() => {
					conn.removeListener('close', onConnectionClose);
				});
				conn.on('error', onConnectionError);
				cleanupLogic.push(() => {
					conn.removeListener('error', onConnectionError);
				});

				const channel = await conn.createChannel();
				channel.on('error', onClose);
				cleanupLogic.push(() => {
					channel.removeListener('error', onClose);
				});
				channel.on('close', onChannelClose);
				cleanupLogic.push(() => {
					clearImmediate(channelClosedImmediate);
					channel.removeListener('close', onChannelClose);
				});

				subscriber.next(channel);
			} catch (e: any) {
				onClose(e);
			}
		};

		createChannel().catch((e) => {
			subscriber.error(e);
		});

		return onClose;
	});
}
