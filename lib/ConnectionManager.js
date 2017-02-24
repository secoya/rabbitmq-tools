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
var amqplib = require("amqplib");
var consumer_1 = require("./consumer");
var publisher_1 = require("./publisher");
function connect(opts) {
    return amqplib.connect(opts);
}
function connectionOptsToAmqplibOpts(opts) {
    return {
        hostname: opts.host,
        password: opts.pass,
        port: opts.port,
        protocol: 'amqp',
        username: opts.user,
        vhost: opts.vhost,
    };
}
function timer(millis) {
    var cancel = null;
    var p = new Promise(function (resolve, reject) {
        var timer = setTimeout(resolve, millis);
        cancel = function () { return clearTimeout(timer); };
    });
    return {
        cancel: cancel,
        promise: p,
    };
}
var ConnectionManager = (function () {
    function ConnectionManager(connectionOptions) {
        var _this = this;
        this.connectionOpened = function () {
            _this.openConnections++;
        };
        this.connectionClosed = function () {
            if (!_this.connected) {
                return;
            }
            if (_this.openConnections === 0) {
                throw new Error('Cannot close a connection with 0 open connections');
            }
            _this.openConnections--;
            if (_this.openConnections === 0) {
                var conn = _this.conn;
                _this.connection = null;
                _this.conn = null;
                _this.connected = false;
                if (!_this.isClosing) {
                    conn.close().catch(function (e) {
                        console.error(e.stack);
                        process.exit(1);
                    });
                }
            }
        };
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
        this.cancelReconnect = function () { return void (0); };
        this.connectionDelay = Promise.resolve();
        this.queueTopology = [];
    }
    ConnectionManager.prototype.onError = function (err) {
        this.connection = null;
        this.conn = null;
        this.openConnections = 0;
        this.connected = false;
        this.isClosing = false;
        this.onDisconnect(err);
    };
    ConnectionManager.prototype.onDisconnect = function (err) {
        this.onDisconnectedCallbacks.forEach(function (v) { return v(err); });
    };
    ConnectionManager.prototype.triggerConnectedCallbacks = function () {
        this.onConnectedCallbacks.forEach(function (v) { return v(); });
    };
    ConnectionManager.prototype.connect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            var conn, e_1, t, ch, _i, _a, topology, dlx, e_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (this.connection != null) {
                            throw new Error('Expected no connection to be present');
                        }
                        return [4 /*yield*/, this.connectionDelay];
                    case 1:
                        _b.sent();
                        this.connectionAttempts++;
                        this.connection = connect(connectionOptsToAmqplibOpts(this.connectionOptions));
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.connection];
                    case 3:
                        conn = _b.sent();
                        this.connectionAttempts = 0;
                        this.connected = true;
                        this.conn = conn;
                        this.triggerConnectedCallbacks();
                        return [3 /*break*/, 5];
                    case 4:
                        e_1 = _b.sent();
                        t = timer(Math.min(60 * 1000, Math.pow(2, this.connectionAttempts) * 1000));
                        this.connectionDelay = t.promise;
                        this.cancelReconnect = t.cancel;
                        this.onError(e_1);
                        throw e_1;
                    case 5:
                        conn.on('error', function (err) {
                            _this.onError(err);
                        });
                        conn.on('close', function (err) {
                            if (err != null) {
                                _this.onError(err);
                                return;
                            }
                            _this.conn = null;
                            _this.connected = false;
                            _this.connection = null;
                            _this.isClosing = false;
                            _this.onDisconnect();
                        });
                        _b.label = 6;
                    case 6:
                        _b.trys.push([6, 8, , 9]);
                        return [4 /*yield*/, conn.createChannel()];
                    case 7:
                        ch = _b.sent();
                        for (_i = 0, _a = this.queueTopology; _i < _a.length; _i++) {
                            topology = _a[_i];
                            dlx = topology.deadLetterExchange || topology.deadLetterRoutingKey != null ? '' : undefined;
                            ch.assertQueue(topology.queueName, {
                                deadLetterExchange: dlx,
                                deadLetterRoutingKey: topology.deadLetterRoutingKey,
                                durable: topology.durable != null ? topology.durable : true,
                            });
                        }
                        return [3 /*break*/, 9];
                    case 8:
                        e_2 = _b.sent();
                        console.error(e_2);
                        process.exit(1);
                        return [3 /*break*/, 9];
                    case 9: return [2 /*return*/, conn];
                }
            });
        });
    };
    ConnectionManager.prototype.addQueueTopology = function (topology) {
        this.queueTopology.push(topology);
    };
    ConnectionManager.prototype.onConnected = function (cb) {
        this.onConnectedCallbacks.push(cb);
    };
    ConnectionManager.prototype.onDisconnected = function (cb) {
        this.onDisconnectedCallbacks.push(cb);
    };
    ConnectionManager.prototype.getConnection = function () {
        if (this.connection != null) {
            return this.connection;
        }
        this.connection = this.connect();
        return this.connection;
    };
    ConnectionManager.prototype.consumeQueue = function (opts, reconnectOnFailure) {
        if (reconnectOnFailure === void 0) { reconnectOnFailure = true; }
        if (this.onDisconnectedCallbacks.length === 0) {
            throw new Error('Must hook a callback up to handle disconnect errors. Probably just to log them somewhere');
        }
        var consumer = consumer_1.consumeQueue(this, this.connectionOpened, this.connectionClosed, opts);
        if (reconnectOnFailure) {
            return consumer.retry();
        }
        return consumer;
    };
    ConnectionManager.prototype.createPublisher = function (opts) {
        return publisher_1.createPublisher(this, this.connectionOpened, this.connectionClosed, opts);
    };
    Object.defineProperty(ConnectionManager.prototype, "isConnected", {
        get: function () {
            return this.connected;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ConnectionManager.prototype, "isDisconnecting", {
        get: function () {
            return this.isClosing;
        },
        enumerable: true,
        configurable: true
    });
    ConnectionManager.prototype.close = function () {
        return __awaiter(this, void 0, void 0, function () {
            var conn;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.isClosing) {
                            throw new Error('Already closing');
                        }
                        this.cancelReconnect();
                        if (!this.connected) {
                            return [2 /*return*/];
                        }
                        conn = this.conn;
                        this.isClosing = true;
                        return [4 /*yield*/, conn.close()];
                    case 1:
                        _a.sent();
                        this.isClosing = false;
                        return [2 /*return*/];
                }
            });
        });
    };
    return ConnectionManager;
}());
exports.ConnectionManager = ConnectionManager;
//# sourceMappingURL=ConnectionManager.js.map