function isEnter(evt) {
    return evt.keyCode === 13 && !evt.shiftKey && !evt.ctrlKey && !evt.metaKey && !evt.altKey;
}
var Actions = (function () {
    function Actions(dispatcher) {
        this.dispatcher = dispatcher;
        var _this = this;
        $('#update-entries').click(function (evt) { return _this.updateEntries(); });
        $('#entry-container').keyup(function (evt) {
            evt.stopPropagation();
            evt.preventDefault();
            if (isEnter(evt)) {
                _this.updateEntries();
            }
        });
        $('#clear-tasks').click(function (evt) { return _this.clearTasks(); });
    }
    Actions.prototype.clearTasks = function () {
        localStorage.clear();
        location.reload(false);
    };
    Actions.prototype.updateEntries = function () {
        var _this = this;
        var entries = $('#entry-container .entry-row'), data = entries.map(function (i, e) { return _this.extractData($(e)); });
        this.dispatcher.dispatch('entry', data);
    };
    Actions.prototype.extractData = function (entry) {
        return {
            date: entry.find('input.date').val(),
            project: entry.find('input.project').val(),
            task: entry.find('input.task').val(),
            start: entry.find('input.start').val(),
        };
    };
    return Actions;
})();
//# sourceMappingURL=actions.js.map