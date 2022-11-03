import * as amqplib from 'amqplib';
import { Observable } from 'rxjs';
import { retry } from 'rxjs/operators';
import { consumeQueue, ConsumerOptions, Message } from './Consumer.js';
import { createPublisher, Publisher, PublisherOptions } from './Publisher.js';

export type ConnectionOptions = amqplib.Options.Connect & AmqplibSocketOpts;

interface AmqplibSocketOpts {
	noDelay?: boolean;
	timeout?: number;
	keepAlive?: boolean;
	keepAliveDelay?: number;
	clientProperties?: { [key: string]: any };
}

function timer(millis: number): {
	promise: Promise<void>;
	cancel: () => void;
} {
	let cancel: () => void = null as any;
	const p = new Promise<void>((resolve) => {
		const timeout = setTimeout(resolve, millis);
		cancel = () => clearTimeout(timeout);
	});

	return {
		cancel: cancel,
		promise: p,
	};
}

export interface QueueTopology extends amqplib.Options.AssertQueue {
	queueName: string;
	// @types/amqplib doesn't define these, but they are legal options
	overflow?: 'drop-head' | 'reject-publish' | 'reject-publish-dlx';
	queueMode?: 'default' | 'lazy';
}

export class ConnectionManager {
	private connectionOptions: ConnectionOptions;
	private connection: Promise<amqplib.Connection> | null;
	private conn: amqplib.Connection | null;
	private openConnections: number;
	private connected: boolean;
	private isClosing: boolean;
	private onConnectedCallbacks: (() => void)[];
	private onDisconnectedCallbacks: ((err?: Error) => void)[];
	private connectionAttempts: number;
	private cancelReconnect: () => void;
	private connectionDelay: Promise<void>;
	private queueTopology: QueueTopology[];

	public constructor(connectionOptions: ConnectionOptions) {
		this.connectionOptions = connectionOptions;
		this.connection = null;
		this.openConnections = 0;
		this.connected = false;
		this.conn = null;
		this.onDisconnectedCallbacks = [];
		this.onConnectedCallbacks = [];
		this.isClosing = false;
		this.connectionAttempts = 0;
		this.cancelReconnect = () => void 0;
		this.connectionDelay = Promise.resolve();
		this.queueTopology = [];
	}

	private onError(err: Error): void {
		this.connection = null;
		this.conn = null;
		this.openConnections = 0;
		this.connected = false;
		this.isClosing = false;
		this.onDisconnect(err);
	}

	private onDisconnect(err?: Error): void {
		this.onDisconnectedCallbacks.forEach((v) => v(err));
	}

	private connectionOpened = () => {
		this.openConnections++;
	};

	private connectionClosed = () => {
		if (!this.connected) {
			return;
		}
		if (this.openConnections === 0) {
			throw new Error('Cannot close a connection with 0 open connections');
		}
		this.openConnections--;

		if (this.openConnections === 0) {
			const conn = this.conn as amqplib.Connection;
			this.connection = null;
			this.conn = null;
			this.connected = false;
			if (!this.isClosing) {
				conn.close().catch((e) => {
					// eslint-disable-next-line no-console
					console.error(e.stack);
					process.exit(1);
				});
			}
		}
	};

	private triggerConnectedCallbacks(): void {
		this.onConnectedCallbacks.forEach((v) => v());
	}

	private async connect(): Promise<amqplib.Connection> {
		if (this.connection != null) {
			throw new Error('Expected no connection to be present');
		}
		await this.connectionDelay;
		this.connectionAttempts++;
		const connectionPromise = amqplib.connect(
			{
				hostname: this.connectionOptions.hostname,
				password: this.connectionOptions.password,
				port: this.connectionOptions.port,
				protocol: 'amqp',
				username: this.connectionOptions.username,
				vhost: this.connectionOptions.vhost,
			},
			{
				clientProperties: this.connectionOptions.clientProperties,
				keepAlive: this.connectionOptions.keepAlive,
				keepAliveDelay: this.connectionOptions.keepAliveDelay,
				noDelay: this.connectionOptions.noDelay,
				timeout: this.connectionOptions.timeout,
			},
		);

		let conn: amqplib.Connection;
		try {
			conn = await connectionPromise;
			this.connectionAttempts = 0;
			this.connected = true;
			this.conn = conn;
			this.triggerConnectedCallbacks();
		} catch (e: any) {
			const t = timer(Math.min(60 * 1000, Math.pow(2, this.connectionAttempts) * 1000));
			this.connectionDelay = t.promise;
			this.cancelReconnect = t.cancel;
			this.onError(e);
			throw e;
		}

		conn.setMaxListeners(0);
		conn.on('error', (err: Error) => {
			this.onError(err);
		});
		conn.on('close', (err?: Error) => {
			if (err != null) {
				this.onError(err);
				return;
			}
			this.conn = null;
			this.connected = false;
			this.connection = null;
			this.isClosing = false;
			this.onDisconnect();
		});

		try {
			const ch = await conn.createChannel();
			for (const topology of this.queueTopology) {
				const dlx = topology.deadLetterExchange || (topology.deadLetterRoutingKey != null ? '' : undefined);
				await ch.assertQueue(topology.queueName, {
					autoDelete: topology.autoDelete != null ? topology.autoDelete : true,
					deadLetterExchange: dlx,
					deadLetterRoutingKey: topology.deadLetterRoutingKey,
					durable: topology.durable != null ? topology.durable : true,
					overflow: topology.overflow,
					queueMode: topology.queueMode,
				} as amqplib.Options.AssertQueue);
			}
			await ch.close();
		} catch (e) {
			// eslint-disable-next-line no-console
			console.error(e);
			process.exit(1);
		}

		return conn;
	}

	public addQueueTopology(topology: QueueTopology): void {
		this.queueTopology.push(topology);
	}

	public async assertQueueTopology(topology: QueueTopology): Promise<void> {
		const conn = await this.getConnection();
		const ch = await conn.createChannel();
		try {
			const dlx = topology.deadLetterExchange || (topology.deadLetterRoutingKey != null ? '' : undefined);
			await ch.assertQueue(topology.queueName, {
				autoDelete: topology.autoDelete != null ? topology.autoDelete : true,
				deadLetterExchange: dlx,
				deadLetterRoutingKey: topology.deadLetterRoutingKey,
				durable: topology.durable != null ? topology.durable : true,
				overflow: topology.overflow,
				queueMode: topology.queueMode,
			} as amqplib.Options.AssertQueue);
		} finally {
			await ch.close();
		}
	}

	public onConnected(cb: () => void): void {
		this.onConnectedCallbacks.push(cb);
	}

	public onDisconnected(cb: (err?: Error) => void): void {
		this.onDisconnectedCallbacks.push(cb);
	}

	public getConnection(): Promise<amqplib.Connection> {
		if (this.connection != null) {
			return this.connection;
		}
		this.connection = this.connect();
		return this.connection;
	}

	public consumeQueue(opts: ConsumerOptions, reconnectOnFailure: boolean = true): Observable<Message> {
		if (this.onDisconnectedCallbacks.length === 0) {
			throw new Error('Must hook a callback up to handle disconnect errors. Probably just to log them somewhere');
		}
		const consumer = consumeQueue(this, this.connectionOpened, this.connectionClosed, opts);

		if (reconnectOnFailure) {
			return consumer.pipe(retry());
		}

		return consumer;
	}

	public createPublisher(opts: PublisherOptions): Publisher {
		return createPublisher(this, this.connectionOpened, this.connectionClosed, opts);
	}

	public get isConnected(): boolean {
		return this.connected;
	}

	public get isDisconnecting(): boolean {
		return this.isClosing;
	}

	public async close(): Promise<void> {
		if (this.isClosing) {
			throw new Error('Already closing');
		}
		this.cancelReconnect();
		if (!this.connected) {
			return;
		}
		const conn = this.conn as amqplib.Connection;
		this.isClosing = true;
		await conn.close();
		this.isClosing = false;
		return;
	}
}
