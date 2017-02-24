import * as amqplib from 'amqplib';
import { Observable } from 'rxjs';
import { ConnectionManager } from './ConnectionManager';
export declare function createChannelObservable(connectionManager: ConnectionManager, connectionOpened: () => void, connectionClosed: () => void): Observable<amqplib.Channel>;
