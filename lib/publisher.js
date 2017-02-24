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
var error_1 = require("amqplib/lib/error");
var ChannelManager_1 = require("./ChannelManager");
var TimeoutError_1 = require("./TimeoutError");
var TIMEOUT = -1;
function timer(millis) {
    return new Promise(function (resolve, reject) {
        setTimeout(function () { return resolve(TIMEOUT); }, millis);
    });
}
function waitFor(eventEmitter, eventName) {
    return new Promise(function (resolve, reject) {
        var onError = function (err) {
            eventEmitter.removeListener('drain', onSuccess);
            reject(err);
        };
        var onSuccess = function () {
            eventEmitter.removeListener('error', onError);
            resolve();
        };
        eventEmitter.once('drain', onSuccess);
        eventEmitter.once('error', onError);
    });
}
function createPublisher(connectionManager, connectionOpened, connectionClosed, publisherOptions) {
    var _this = this;
    var maximumInMemoryQueueSize = publisherOptions.maximumInMemoryQueueSize || 100;
    var resolvePromise;
    var rejectPromise;
    var done = false;
    var channelPromise;
    var newPromise = function () {
        channelPromise = new Promise(function (resolve, reject) {
            resolvePromise = resolve;
            rejectPromise = reject;
        });
    };
    newPromise();
    var subscription = ChannelManager_1.createChannelObservable(connectionManager, connectionOpened, connectionClosed).retryWhen(function (errors) {
        return errors.map(function (e) {
            newPromise();
            return null;
        });
    }).flatMap(function (ch) { return __awaiter(_this, void 0, void 0, function () {
        var e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, ch.checkQueue(publisherOptions.queueName)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, ch];
                case 2:
                    e_1 = _a.sent();
                    console.error(e_1);
                    process.exit(1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); }).subscribe({
        error: function (e) {
            console.error('Unknown error');
            console.error(e.stack);
            process.exit(1);
        },
        next: function (channel) {
            resolvePromise(channel);
        },
    });
    var maxSize = publisherOptions.maximumInMemoryQueueSize || 100;
    var deliveringMessages = false;
    var deliver = function () { return __awaiter(_this, void 0, void 0, function () {
        var msg, channel, success, e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    deliveringMessages = true;
                    _a.label = 1;
                case 1:
                    if (!(messages.length > 0 && !done)) return [3 /*break*/, 9];
                    msg = messages.splice(0, 1)[0];
                    return [4 /*yield*/, channelPromise];
                case 2:
                    channel = _a.sent();
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 7, , 8]);
                    success = channel.sendToQueue(publisherOptions.queueName, msg[0], {
                        persistent: publisherOptions.persistent != null ? publisherOptions.persistent : true,
                    });
                    if (!!success) return [3 /*break*/, 5];
                    messages.unshift(msg);
                    return [4 /*yield*/, waitFor(channel, 'drain')];
                case 4:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 5:
                    msg[1]();
                    _a.label = 6;
                case 6: return [3 /*break*/, 8];
                case 7:
                    e_2 = _a.sent();
                    if (!(e_2 instanceof error_1.IllegalOperationError)) {
                        throw e_2;
                    }
                    messages.unshift(msg);
                    return [3 /*break*/, 8];
                case 8: return [3 /*break*/, 1];
                case 9:
                    deliveringMessages = false;
                    return [2 /*return*/];
            }
        });
    }); };
    var messages = [];
    var publish = function (msg, timeout, removeOnTimeout) {
        if (removeOnTimeout === void 0) { removeOnTimeout = false; }
        return __awaiter(_this, void 0, void 0, function () {
            var entry, promise, timeoutPromise, winner, idx, err;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (messages.length === maximumInMemoryQueueSize) {
                            throw new Error('Maxixmum in memory queue size exceeded');
                        }
                        if (done) {
                            throw new Error('Already closed');
                        }
                        entry = null;
                        promise = new Promise(function (resolve, reject) {
                            entry = [msg, resolve, reject, true];
                            messages.push(entry);
                        });
                        if (!deliveringMessages) {
                            deliver().catch(function (e) {
                                console.error(e);
                                process.exit(1);
                            });
                        }
                        if (!timeout) return [3 /*break*/, 2];
                        timeoutPromise = timer(timeout);
                        return [4 /*yield*/, Promise.race([promise, timeoutPromise])];
                    case 1:
                        winner = _a.sent();
                        if (winner === TIMEOUT) {
                            idx = messages.indexOf(entry);
                            err = new TimeoutError_1.TimeoutError('Message timed out after ' + timeout + ' milliseconds');
                            if (idx >= 0) {
                                entry[2](err);
                                messages.splice(idx, 1);
                            }
                            throw err;
                        }
                        return [2 /*return*/];
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    publish.closePublisher = function () {
        done = true;
        subscription.unsubscribe();
    };
    return publish;
}
exports.createPublisher = createPublisher;
//# sourceMappingURL=publisher.js.map