import * as amqplib from 'amqplib';
import { Observable } from 'rxjs';
import { ConsumerOptions, Message } from './consumer';
import { Publisher, PublisherOptions } from './publisher';
export interface ConnectionOptions {
    host: string;
    port: string | number;
    vhost: string;
    user: string;
    pass: string;
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
export declare class ConnectionManager {
    private connectionOptions;
    private connection;
    private conn;
    private openConnections;
    private connected;
    private isClosing;
    private onConnectedCallbacks;
    private onDisconnectedCallbacks;
    private onDisconnectingCallbacks;
    private connectionAttempts;
    private cancelReconnect;
    private connectionDelay;
    private queueTopology;
    constructor(connectionOptions: ConnectionOptions);
    private onError(err);
    private onDisconnect(err?);
    private connectionOpened;
    private connectionClosed;
    private triggerConnectedCallbacks();
    private connect();
    addQueueTopology(topology: QueueTopology): void;
    onConnected(cb: () => void): void;
    onDisconnected(cb: (err?: Error) => void): void;
    getConnection(): Promise<amqplib.Connection>;
    consumeQueue(opts: ConsumerOptions, reconnectOnFailure?: boolean): Observable<Message>;
    createPublisher(opts: PublisherOptions): Publisher;
    readonly isConnected: boolean;
    readonly isDisconnecting: boolean;
    close(): Promise<void>;
}
