import * as amqplib from 'amqplib';
import { Observable, Subscriber } from 'rxjs';
import { consumeQueue, ConsumerOptions, Message } from './consumer';
import { createPublisher, Publisher, PublisherOptions } from './publisher';

export interface ConnectionOptions {
	host: string;
	port: string | number;
	vhost: string;
	user: string;
	pass: string;
}

function connect(opts: AmqplibOpts): Promise<amqplib.Connection> {
	return amqplib.connect(opts as any) as any;
}

interface AmqplibOpts {
	hostname: string;
	password: string;
	port: string | number;
	protocol: 'amqp';
	username: string;
	vhost: string;
}

function connectionOptsToAmqplibOpts(opts: ConnectionOptions): AmqplibOpts {
	return {
		hostname: opts.host,
		password: opts.pass,
		port: opts.port,
		protocol: 'amqp',
		username: opts.user,
		vhost: opts.vhost,
	};
}

function timer(millis: number): {
	promise: Promise<void>;
	cancel: () => void;
} {
	let cancel: () => void = null as any;
	const p = new Promise<void>((resolve, reject) => {
		const timer = setTimeout(resolve, millis);
		cancel = () => clearTimeout(timer);
	});

	return {
		cancel: cancel,
		promise: p,
	};
}

export interface QueueTopology {
	queueName: string;
	durable?: boolean;
	/**
	 * Specifies a dead letter exchange. Use this only to route to an actual exchange.
	 * To route to a named queue, set deadLetterRoutingKey.
	 */
	deadLetterExchange?: string;

	/**
	 * Specifies a routing key for dead letters. If no exchange is specified, this equals,
	 * to a queue name.
	 */
	deadLetterRoutingKey?: string;
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
	private onDisconnectingCallbacks: (() => void)[];
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
		this.onDisconnectingCallbacks = [];
		this.isClosing = false;
		this.connectionAttempts = 0;
		this.cancelReconnect = () => void (0);
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
		this.onDisconnectedCallbacks.forEach(v => v(err));
	}

	private connectionOpened = () => {
		this.openConnections++;
	}

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
				conn.close().catch(e => {
					console.error(e.stack);
					process.exit(1);
				});
			}
		}
	}

	private triggerConnectedCallbacks(): void {
		this.onConnectedCallbacks.forEach(v => v());
	}

	private async connect(): Promise<amqplib.Connection> {
		if (this.connection != null) {
			throw new Error('Expected no connection to be present');
		}
		await this.connectionDelay;
		this.connectionAttempts++;
		this.connection = connect(connectionOptsToAmqplibOpts(this.connectionOptions));

		let conn: amqplib.Connection;
		try {
			conn = await this.connection;
			this.connectionAttempts = 0;
			this.connected = true;
			this.conn = conn;
			this.triggerConnectedCallbacks();

		} catch (e) {
			const t = timer(Math.min(60 * 1000, Math.pow(2, this.connectionAttempts) * 1000));
			this.connectionDelay = t.promise;
			this.cancelReconnect = t.cancel;
			this.onError(e);
			throw e;
		}

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
					deadLetterExchange: dlx,
					deadLetterRoutingKey: topology.deadLetterRoutingKey,
					durable: topology.durable != null ? topology.durable : true,
				});
			}
		} catch (e) {
			console.error(e);
			process.exit(1);
		}

		return conn;
	}

	public addQueueTopology(topology: QueueTopology): void {
		this.queueTopology.push(topology);
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
			return consumer.retry();
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
