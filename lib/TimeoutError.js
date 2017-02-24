"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var TimeoutError = (function (_super) {
    __extends(TimeoutError, _super);
    function TimeoutError() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return TimeoutError;
}(Error));
exports.TimeoutError = TimeoutError;
//# sourceMappingURL=TimeoutError.js.map