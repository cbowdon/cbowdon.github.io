var Dispatcher = (function () {
    function Dispatcher() {
        this.events = {};
    }
    Dispatcher.prototype.register = function (name, callback) {
        if (!this.events[name]) {
            this.events[name] = [callback];
        }
        else {
            this.events[name].push(callback);
        }
    };
    Dispatcher.prototype.dispatch = function (name, payload) {
        if (this.events[name]) {
            _.each(this.events[name], function (cb) { return cb(payload); });
        }
    };
    return Dispatcher;
})();
//# sourceMappingURL=dispatcher.js.map