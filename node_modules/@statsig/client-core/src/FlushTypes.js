"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlushType = void 0;
/* eslint-disable no-restricted-syntax */
var FlushType;
(function (FlushType) {
    FlushType["ScheduledMaxTime"] = "scheduled:max_time";
    FlushType["ScheduledFullBatch"] = "scheduled:full_batch";
    FlushType["Limit"] = "limit";
    FlushType["Manual"] = "manual";
    FlushType["Shutdown"] = "shutdown";
})(FlushType || (exports.FlushType = FlushType = {}));
