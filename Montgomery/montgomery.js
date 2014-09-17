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
var Publisher = (function () {
    function Publisher() {
        this.handlers = [];
    }
    Publisher.prototype.subscribe = function (handler) {
        this.handlers.push(handler);
    };
    Publisher.prototype.publish = function (t) {
        this.handlers.forEach(function (h) { return h(t); });
    };
    return Publisher;
})();
var VALID_TIME_FORMATS = ['HH:mm', 'HHmm', 'hh:mm a'];
var VALID_DATE_FORMATS = ['YYYY-MM-DD'];
var PREFERRED_TIME_FORMAT = 'HH:mm';
var PREFERRED_DATE_FORMAT = 'YYYY-MM-DD';
var Validated = (function () {
    function Validated(value, errors) {
        this.value = value;
        this.errors = errors;
        this.isValid = !errors;
    }
    Validated.valid = function (val) {
        return new Validated(val);
    };
    Validated.invalid = function (val, errs) {
        return new Validated(val, errs);
    };
    return Validated;
})();
var RawEntryValidator = (function () {
    function RawEntryValidator() {
    }
    RawEntryValidator.prototype.validate = function (raw) {
        var prop, errs = [], time, date;
        if (!raw.project) {
            errs.push('Invalid project');
        }
        time = moment(raw.start, VALID_TIME_FORMATS, true);
        if (!time.isValid()) {
            errs.push('Invalid time');
        }
        date = moment(raw.date, VALID_DATE_FORMATS, true);
        if (!date.isValid()) {
            errs.push('Invalid date');
        }
        if (errs.length > 0) {
            return Validated.invalid(raw, errs);
        }
        return Validated.valid({
            project: raw.project,
            task: raw.task,
            start: time.format(PREFERRED_TIME_FORMAT),
            date: date.format(PREFERRED_DATE_FORMAT)
        });
    };
    return RawEntryValidator;
})();
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var Store = (function (_super) {
    __extends(Store, _super);
    function Store(dispatcher) {
        _super.call(this);
        this.dispatcher = dispatcher;
        var _this = this;
        this.key = 'Montgomery';
        this.validator = new RawEntryValidator();
        dispatcher.register('entry', function (data) { return _this.update(data); });
    }
    Store.prototype.load = function () {
        var rawEntries = JSON.parse(localStorage.getItem(this.key));
        if (rawEntries) {
            this.update(rawEntries);
        }
    };
    Store.prototype.update = function (rawEntries) {
        var _this = this;
        var validated = _.chain(rawEntries).filter(function (re) { return _.some(_.values(re)); }).map(function (re) { return _this.validator.validate(re); }).value();
        if (_.every(validated, function (v) { return v.isValid; })) {
            this.save(_.map(validated, function (v) { return v.value; }));
        }
        this.publish({ validated: validated });
    };
    Store.prototype.save = function (rawEntries) {
        var serialized = JSON.stringify(rawEntries);
        localStorage.setItem(this.key, serialized);
    };
    return Store;
})(Publisher);
function toTimeEntry(r) {
    var dateRes = moment(r.date, PREFERRED_DATE_FORMAT, true), timeRes = moment(r.start, PREFERRED_TIME_FORMAT, true);
    if (!dateRes.isValid() || !timeRes.isValid()) {
        throw new Error('Invalid datetime.');
    }
    timeRes.year(dateRes.year());
    timeRes.month(dateRes.month());
    timeRes.date(dateRes.date());
    return {
        project: r.project,
        task: r.task,
        date: dateRes,
        start: timeRes,
        end: undefined,
        minutes: undefined
    };
}
function calculateMinutes(day) {
    if (day.length < 2) {
        return [];
    }
    return _.chain(day).sortBy(function (r) { return r.start.format(); }).reduce(function (acc, r, i) {
        if (i === 0) {
            return [r];
        }
        acc[i - 1].end = r.start;
        acc[i - 1].minutes = acc[i - 1].end.diff(acc[i - 1].start) / (60 * 1000);
        if (i !== day.length - 1) {
            acc.push(r);
        }
        return acc;
    }, []).value();
}
function sumMinutes(day) {
    return _.reduce(day, function (acc, r) {
        var existing;
        if (r.project.toLowerCase() === 'home' || r.project.toLowerCase() === 'lunch') {
            return acc;
        }
        existing = _.find(acc, function (a) { return a.project === r.project && a.task === r.task; });
        if (!existing) {
            acc.push({ project: r.project, task: r.task, minutes: r.minutes, date: r.date });
            return acc;
        }
        existing.minutes += r.minutes;
        return acc;
    }, []);
}
var EntryCollection = (function (_super) {
    __extends(EntryCollection, _super);
    function EntryCollection(store) {
        _super.call(this);
        var _this = this;
        store.subscribe(function (su) { return _this.update(su.validated); });
    }
    EntryCollection.extractEntries = function (rawEntries) {
        var timeEntries = _.map(rawEntries, toTimeEntry);
        var days = _.groupBy(timeEntries, function (r) { return r.date.format(PREFERRED_DATE_FORMAT); });
        console.log(days);
        var daysArray = _.values(days);
        var populated = _.map(daysArray, calculateMinutes);
        console.log('pop', populated);
        var summed = _.map(populated, sumMinutes);
        return _.flatten(summed);
    };
    EntryCollection.prototype.update = function (rawEntries) {
        if (rawEntries.length < 2 || !_.every(rawEntries, function (r) { return r.isValid; })) {
            return;
        }
        var entries = EntryCollection.extractEntries(_.map(rawEntries, function (r) { return r.value; }));
        this.publish({ entries: entries });
    };
    return EntryCollection;
})(Publisher);
var ViewController;
(function (ViewController) {
    var UserInput = (function () {
        function UserInput(store) {
            this.store = store;
            var _this = this;
            this.templates = $('#templates');
            this.addBlankRow(0);
            store.subscribe(function (evt) { return _this.sync(evt); });
        }
        UserInput.prototype.sync = function (evt) {
            var _this = this;
            var numEvents = evt.validated.length, container = $('#entry-container');
            container.empty();
            _.each(evt.validated, function (v, i) {
                _this.addBlankRow(i);
                _this.fillRow(i, v.value);
                if (!v.isValid) {
                    _this.addErrors(i, v.errors);
                }
            });
            container.find('.entry-row.has-error input:first').focus();
            if (_.every(evt.validated, function (v) { return v.isValid; })) {
                this.addBlankRow(numEvents);
                if (numEvents > 0) {
                    this.autoFillDate(numEvents, moment().format(PREFERRED_DATE_FORMAT));
                }
                container.find('.entry-row input.date:last').focus();
            }
            else {
                container.find('.entry-row.has-error input:first').focus();
            }
        };
        UserInput.prototype.addBlankRow = function (id) {
            var entries = $('#entry-container'), newRow = this.templates.find('#entry').clone(), defDate = moment().format(PREFERRED_DATE_FORMAT);
            newRow.attr('id', 'entry-' + id);
            newRow.find('input.date').val(defDate);
            entries.append(newRow);
        };
        UserInput.prototype.fillRow = function (id, values) {
            var row = $('#entry-' + id);
            row.find('input.date').val(values.date);
            row.find('input.project').val(values.project);
            row.find('input.task').val(values.task);
            row.find('input.start').val(values.start);
            row.addClass('has-success');
            row.find('hr').removeClass('hidden');
            row.find('button.clear-row').removeClass('hidden').removeAttr('disabled').click(function (evt) { return row.find('input').val(null); });
        };
        UserInput.prototype.autoFillDate = function (id, date) {
            var row = $('#entry-' + id);
            row.find('input.date').val(date);
        };
        UserInput.prototype.addErrors = function (id, messages) {
            var row = $('#entry-' + id), ul = row.find('#errors');
            row.addClass('has-error');
            ul.empty();
            messages.forEach(function (m) { return ul.append('<li>' + m + '</li>'); });
        };
        UserInput.prototype.clearErrors = function (id) {
            var row = $('#entry-' + id), ul = row.find('#errors');
            row.removeClass('has-error');
            ul.empty();
        };
        return UserInput;
    })();
    ViewController.UserInput = UserInput;
})(ViewController || (ViewController = {}));
var ViewController;
(function (ViewController) {
    var SumTable = (function () {
        function SumTable(ec) {
            var _this = this;
            this.templates = $('#templates');
            ec.subscribe(function (e) { return _this.update(e.entries); });
        }
        SumTable.prototype.update = function (entries) {
            var container = $('#sum-container'), templ = this.templates.find('#sum');
            container.empty();
            if (entries.length === 0) {
                return;
            }
            _.chain(entries).sortBy(function (e) { return e.task; }).sortBy(function (e) { return e.project; }).sortBy(function (e) { return e.date.milliseconds(); }).each(function (e, i) {
                var newRow = templ.clone();
                newRow.attr('id', 'sum-' + i);
                newRow.find('.date').html(e.date.format('YYYY-MM-DD'));
                newRow.find('.project').html(e.project);
                newRow.find('.task').html(e.task);
                newRow.find('.minutes').html(e.minutes.toString());
                container.append(newRow);
            });
        };
        return SumTable;
    })();
    ViewController.SumTable = SumTable;
})(ViewController || (ViewController = {}));
var ViewController;
(function (ViewController) {
    var ProjectChart = (function () {
        function ProjectChart(ec) {
            var _this = this;
            ec.subscribe(function (e) { return _this.update(e.entries); });
        }
        ProjectChart.prototype.sumByProject = function (entries) {
            return _.chain(entries).reduce(function (acc, e) {
                var existing = _.find(acc, function (a) { return a.project === e.project; });
                if (!existing) {
                    acc.push({ project: e.project, minutes: e.minutes });
                    return acc;
                }
                existing.minutes += e.minutes;
                return acc;
            }, []).value();
        };
        ProjectChart.prototype.update = function (entries) {
            var rad = 100, len = 300, data = this.sumByProject(entries), vis, arc, pie, color, arcs;
            $('#chart-container').empty();
            if (entries.length === 0) {
                return;
            }
            vis = d3.select('#chart-container').append('svg:svg').data([data]).attr('width', len).attr('height', len).append('svg:g').attr('transform', 'translate(' + rad + ', ' + rad + ')');
            arc = d3.svg.arc().outerRadius(rad);
            pie = d3.layout.pie().value(function (e) { return e.minutes; });
            color = d3.scale.category20();
            arcs = vis.selectAll('g.slice').data(pie).enter().append('svg:g').attr('class', 'slice');
            arcs.append('svg:path').attr('fill', function (d, i) { return color(i); }).attr('d', arc);
            arcs.append('svg:text').attr('transform', function (d) {
                d.innerRadius = 0;
                d.outerRadius = rad;
                return 'translate(' + arc.centroid(d) + ')';
            }).attr('text-anchor', 'middle').text(function (d, i) { return data[i].project + ': ' + data[i].minutes; });
        };
        return ProjectChart;
    })();
    ViewController.ProjectChart = ProjectChart;
})(ViewController || (ViewController = {}));'use strict';
var dispatcher = new Dispatcher();
var actions = new Actions(dispatcher);
var store = new Store(dispatcher);
var ec = new EntryCollection(store);
var userInput = new ViewController.UserInput(store);
var sumTable = new ViewController.SumTable(ec);
var projectChart = new ViewController.ProjectChart(ec);
store.load();
//# sourceMappingURL=montgomery.js.map