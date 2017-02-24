"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t;
    return { next: verb(0), "throw": verb(1), "return": verb(2) };
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var RxJS = require("rxjs");
var ConnectionClosedError_1 = require("./ConnectionClosedError");
function createConsumer(connectionManager, consumerOptions, connectionOpened, connectionClosed, subscriber, onClose) {
    return __awaiter(this, void 0, void 0, function () {
        var connection, channel, connected, consumerTag, cancelChannel, teardown, onError, onChannelError, onClosed, onChannelClose, e_1, e_2, ch, onMessage, e_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    connection = null;
                    channel = null;
                    connected = false;
                    consumerTag = null;
                    cancelChannel = true;
                    teardown = function () {
                        var closeConnection = true;
                        var onConnectionClosed = function () {
                            if (connected) {
                                connectionClosed();
                            }
                        };
                        if (consumerTag != null && channel != null && connected && cancelChannel) {
                            channel.cancel(consumerTag).then(onConnectionClosed).catch(function (e) {
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
                    onError = function (err) {
                        cancelChannel = false;
                        subscriber.error(err);
                        teardown();
                    };
                    onChannelError = function (err) {
                        cancelChannel = false;
                        subscriber.error(err);
                        teardown();
                    };
                    onClosed = function (err) {
                        cancelChannel = false;
                        if (err) {
                            subscriber.error(new ConnectionClosedError_1.ConnectionClosedError('The underlying connection was closed.', err));
                        }
                        else {
                            subscriber.complete();
                        }
                        teardown();
                    };
                    onChannelClose = function (err) {
                        cancelChannel = false;
                        teardown();
                    };
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, connectionManager.getConnection()];
                case 2:
                    connection = _a.sent();
                    connected = true;
                    connectionOpened();
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _a.sent();
                    subscriber.error(e_1);
                    teardown();
                    return [2 /*return*/];
                case 4:
                    connection.on('error', onError);
                    connection.on('close', onClosed);
                    _a.label = 5;
                case 5:
                    _a.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, connection.createChannel()];
                case 6:
                    channel = _a.sent();
                    return [3 /*break*/, 8];
                case 7:
                    e_2 = _a.sent();
                    subscriber.error(e_2);
                    teardown();
                    return [2 /*return*/];
                case 8:
                    ch = channel;
                    ch.on('error', onChannelError);
                    ch.on('closed', onChannelClose);
                    onMessage = function (msg) {
                        subscriber.next({
                            ack: function (allUpTo) {
                                if (channel != null) {
                                    ch.ack(msg);
                                }
                            },
                            nack: function (requeue, allUpTo) {
                                if (channel != null) {
                                    ch.nack(msg, allUpTo, requeue);
                                }
                            },
                            message: msg,
                        });
                    };
                    _a.label = 9;
                case 9:
                    _a.trys.push([9, 13, , 14]);
                    return [4 /*yield*/, channel.checkQueue(consumerOptions.queueName)];
                case 10:
                    _a.sent();
                    return [4 /*yield*/, channel.prefetch(consumerOptions.prefetch || 1)];
                case 11:
                    _a.sent(); // Not global, ie. per consumer
                    return [4 /*yield*/, channel.consume(consumerOptions.queueName, onMessage, {
                            noAck: false,
                        })];
                case 12:
                    consumerTag = (_a.sent()).consumerTag;
                    return [3 /*break*/, 14];
                case 13:
                    e_3 = _a.sent();
                    subscriber.error(e_3);
                    teardown();
                    return [2 /*return*/];
                case 14:
                    onClose(function () {
                        teardown();
                    });
                    return [2 /*return*/];
            }
        });
    });
}
function consumeQueue(connectionManager, connectionOpened, connectionClosed, consumerOptions) {
    return new RxJS.Observable(function (subscriber) {
        var closed = false;
        var closeCallback = null;
        var onClose = function (cb) {
            if (closed) {
                cb();
            }
            else {
                closeCallback = cb;
            }
        };
        createConsumer(connectionManager, consumerOptions, connectionOpened, connectionClosed, subscriber, onClose).catch(function (e) {
            console.error('Create consumer error', e.stack);
            process.exit(1);
        });
        return function () {
            closed = true;
            if (closeCallback != null) {
                closeCallback();
            }
        };
    });
}
exports.consumeQueue = consumeQueue;
//# sourceMappingURL=consumer.js.map