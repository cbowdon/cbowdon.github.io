/// <reference path="../typings/tsd.d.ts" />
var Dispatcher = (function () {
    function Dispatcher() {
        // TODO not super happy about this Dictionary<magic string, any action>
        // doesn't seem to be taking advantage of static types at all
        // (and even less happy with the giant switch statement approach in the Flux demo)
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
/// <reference path="../typings/tsd.d.ts" />
/// <reference path="dispatcher.ts" />
function isEnter(evt) {
    return evt.keyCode === 13 && !evt.shiftKey && !evt.ctrlKey && !evt.metaKey && !evt.altKey;
}
var Actions = (function () {
    function Actions(dispatcher) {
        var _this = this;
        this.dispatcher = dispatcher;
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
            start: entry.find('input.start').val()
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
/// <reference path="../typings/tsd.d.ts" />
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
/// <reference path="../typings/tsd.d.ts" />
/// <reference path="publisher.ts" />
/// <reference path="validator.ts" />
/// <reference path="dispatcher.ts" />
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var Store = (function (_super) {
    __extends(Store, _super);
    function Store(dispatcher) {
        var _this = this;
        _super.call(this);
        this.dispatcher = dispatcher;
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
/// <reference path="../typings/tsd.d.ts" />
/// <reference path="store.ts" />
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
function extractEntries(rawEntries) {
    var timeEntries = _.map(rawEntries, toTimeEntry);
    var days = _.groupBy(timeEntries, function (r) { return r.date.format(PREFERRED_DATE_FORMAT); });
    var daysArray = _.values(days);
    // tsc was inferring wrong types here, hence no chain
    // it could be that underscore.d.ts is not right
    var populated = _.map(daysArray, calculateMinutes);
    var summed = _.map(populated, sumMinutes);
    return _.flatten(summed);
}
var EntryCollection = (function (_super) {
    __extends(EntryCollection, _super);
    function EntryCollection(store) {
        var _this = this;
        _super.call(this);
        store.subscribe(function (su) { return _this.update(su.validated); });
    }
    EntryCollection.prototype.update = function (rawEntries) {
        if (rawEntries.length < 2 || !_.every(rawEntries, function (r) { return r.isValid; })) {
            return;
        }
        var entries = extractEntries(_.map(rawEntries, function (r) { return r.value; }));
        this.publish({ entries: entries });
    };
    return EntryCollection;
})(Publisher);
/// <reference path="../../typings/tsd.d.ts" />
/// <reference path="../store.ts" />
var ViewController;
(function (ViewController) {
    var UserInput = (function () {
        function UserInput(store) {
            var _this = this;
            this.store = store;
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
            // put focus on first row with errors
            container.find('.entry-row.has-error input:first').focus();
            if (_.every(evt.validated, function (v) { return v.isValid; })) {
                this.addBlankRow(numEvents);
                if (numEvents > 0) {
                    this.autoFillDate(numEvents, moment().format(PREFERRED_DATE_FORMAT));
                }
                // put focus on the first input in the new blank row
                container.find('.entry-row input.date:last').focus();
            }
            else {
                // put focus on first row with errors
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
/// <reference path="../../typings/tsd.d.ts" />
/// <reference path="../entry.ts" />
var ViewController;
(function (ViewController) {
    function displayHours(minutes) {
        var hrs = (minutes / 60.0).toString(), ptIdx = hrs.indexOf('.');
        // sub-minute rounding errors are tolerable
        return ptIdx === -1 ? hrs : hrs.substring(0, ptIdx + 3);
    }
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
            _.chain(entries).sortBy(function (e) { return e.task; }).sortBy(function (e) { return e.project; }).sortBy(function (e) { return e.date.format(PREFERRED_DATE_FORMAT); }).each(function (e, i) {
                var newRow = templ.clone();
                newRow.attr('id', 'sum-' + i);
                newRow.find('.date').html(e.date.format(PREFERRED_DATE_FORMAT));
                newRow.find('.project').html(e.project);
                newRow.find('.task').html(e.task);
                newRow.find('.hours').html(displayHours(e.minutes));
                container.append(newRow);
            });
        };
        return SumTable;
    })();
    ViewController.SumTable = SumTable;
})(ViewController || (ViewController = {}));
/// <reference path="../../typings/tsd.d.ts" />
/// <reference path="../entry.ts" />
var ViewController;
(function (ViewController) {
    var ProjectChart = (function () {
        function ProjectChart(ec) {
            var _this = this;
            this.canvas = document.getElementById('chart-container');
            this.ctx = this.canvas.getContext('2d');
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
            }, []);
        };
        ProjectChart.prototype.update = function (entries) {
            var data, options, colGen;
            colGen = new ColorGenerator();
            data = this.sumByProject(entries).map(function (s) {
                var col = colGen.next();
                return {
                    color: col.toString(),
                    highlight: col.highlight().toString(),
                    label: s.project,
                    value: s.minutes
                };
            }).value();
            options = {
                showToolTips: true
            };
            new Chart(this.ctx).Pie(data, options);
        };
        return ProjectChart;
    })();
    ViewController.ProjectChart = ProjectChart;
    var Color = (function () {
        function Color(red, green, blue) {
            this.red = red;
            this.green = green;
            this.blue = blue;
        }
        Color.prototype.highlight = function () {
            return new Color(this.red + 50, this.green + 50, this.blue + 50);
        };
        Color.prototype.toString = function () {
            return 'rgb(' + this.red + ', ' + this.green + ', ' + this.blue + ')';
        };
        return Color;
    })();
    var ColorGenerator = (function () {
        function ColorGenerator() {
            this.colors = [
                new Color(0x66, 0, 0),
                new Color(0x44, 0x44, 0),
                new Color(0, 0x66, 0),
                new Color(0, 0x44, 0x44),
                new Color(0, 0, 0x66)
            ];
            this.idx = 0;
        }
        ColorGenerator.prototype.next = function () {
            this.idx += 1;
            if (this.idx >= this.colors.length) {
                this.idx = 0;
            }
            return this.colors[this.idx];
        };
        return ColorGenerator;
    })();
})(ViewController || (ViewController = {}));
/// <reference path="actions.ts" />
/// <reference path="dispatcher.ts" />
/// <reference path="store.ts" />
/// <reference path="entry.ts" />
/// <reference path="view-controllers/user-input.ts" />
/// <reference path="view-controllers/sum-table.ts" />
/// <reference path="view-controllers/project-chart.ts" />
'use strict';
var dispatcher = new Dispatcher();
var actions = new Actions(dispatcher);
var store = new Store(dispatcher);
var ec = new EntryCollection(store);
var userInput = new ViewController.UserInput(store);
var sumTable = new ViewController.SumTable(ec);
var projectChart = new ViewController.ProjectChart(ec);
store.load();
//# sourceMappingURL=montgomery.js.map