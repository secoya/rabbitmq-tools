"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var ConnectionClosedError = (function (_super) {
    __extends(ConnectionClosedError, _super);
    function ConnectionClosedError(message, previousError) {
        var _this = _super.call(this, message) || this;
        _this._previousError = previousError || null;
        return _this;
    }
    Object.defineProperty(ConnectionClosedError.prototype, "previousError", {
        get: function () {
            return this._previousError;
        },
        enumerable: true,
        configurable: true
    });
    return ConnectionClosedError;
}(Error));
exports.ConnectionClosedError = ConnectionClosedError;
//# sourceMappingURL=ConnectionClosedError.js.map