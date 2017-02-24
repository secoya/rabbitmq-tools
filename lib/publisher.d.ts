/// <reference types="node" />
import { ConnectionManager } from './ConnectionManager';
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
export interface PublisherOptions {
    queueName: string;
    persistent?: boolean;
    maximumInMemoryQueueSize?: number;
}
export declare function createPublisher(connectionManager: ConnectionManager, connectionOpened: () => void, connectionClosed: () => void, publisherOptions: PublisherOptions): Publisher;
