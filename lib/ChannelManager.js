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
var rxjs_1 = require("rxjs");
var ConnectionClosedError_1 = require("./ConnectionClosedError");
function createChannelObservable(connectionManager, connectionOpened, connectionClosed) {
    var _this = this;
    return new rxjs_1.Observable(function (subscriber) {
        var isClosed = false;
        var isCleanupHandlersCalled = false;
        var onClose = function (err) {
            if (!isCleanupHandlersCalled) {
                cleanupLogic.forEach(function (v) { return v(); });
                isCleanupHandlersCalled = true;
            }
            if (err) {
                subscriber.error(err);
            }
            else {
                subscriber.complete();
            }
            isClosed = true;
        };
        var cleanupLogic = [];
        var createChannel = function () { return __awaiter(_this, void 0, void 0, function () {
            var conn_1, onConnectionClose_1, onConnectionError_1, channelClosedImmediate_1, onChannelClose_1, channel_1, onChannelError, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, connectionManager.getConnection()];
                    case 1:
                        conn_1 = _a.sent();
                        connectionOpened();
                        cleanupLogic.push(connectionClosed);
                        onConnectionClose_1 = function (err) {
                            if (err != null) {
                                onClose(new ConnectionClosedError_1.ConnectionClosedError('The underlying connection was closed.', err));
                            }
                            else {
                                onClose();
                            }
                        };
                        onConnectionError_1 = function (err) {
                            onClose(err);
                        };
                        channelClosedImmediate_1 = null;
                        onChannelClose_1 = function (err) {
                            channelClosedImmediate_1 = setImmediate(function () { return onClose(err); });
                        };
                        conn_1.on('close', onConnectionClose_1);
                        cleanupLogic.push(function () {
                            conn_1.removeListener('close', onConnectionClose_1);
                        });
                        conn_1.on('error', onConnectionError_1);
                        cleanupLogic.push(function () {
                            conn_1.removeListener('error', onConnectionError_1);
                        });
                        return [4 /*yield*/, conn_1.createChannel()];
                    case 2:
                        channel_1 = _a.sent();
                        onChannelError = function (err) {
                            onClose(err);
                        };
                        channel_1.on('error', onClose);
                        cleanupLogic.push(function () {
                            channel_1.removeListener('error', onClose);
                        });
                        channel_1.on('close', onChannelClose_1);
                        cleanupLogic.push(function () {
                            clearImmediate(channelClosedImmediate_1);
                            channel_1.removeListener('close', onChannelClose_1);
                        });
                        subscriber.next(channel_1);
                        return [3 /*break*/, 4];
                    case 3:
                        e_1 = _a.sent();
                        onClose(e_1);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); };
        createChannel().catch(function (e) {
            isClosed = true;
            subscriber.error(e);
        });
        return onClose;
    });
}
exports.createChannelObservable = createChannelObservable;
//# sourceMappingURL=ChannelManager.js.map