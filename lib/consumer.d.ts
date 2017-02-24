import * as amqplib from 'amqplib';
import * as RxJS from 'rxjs';
import { ConnectionManager } from './ConnectionManager';
export interface ConsumerOptions {
    prefetch?: number;
    queueName: string;
}
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
export declare function consumeQueue(connectionManager: ConnectionManager, connectionOpened: () => void, connectionClosed: () => void, consumerOptions: ConsumerOptions): RxJS.Observable<Message>;
