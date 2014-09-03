var Result = (function () {
    function Result(value, errors) {
        this.value = value;
        this.errors = errors;
        this.isSuccess = !!value;
    }
    Result.success = function (val) {
        return new Result(val, []);
    };
    Result.fail = function (errs) {
        return new Result(null, errs);
    };
    return Result;
})();
var ShortDate = (function () {
    function ShortDate(date) {
        if (date === void 0) { date = new Date(); }
        this.year = date.getFullYear();
        this.month = date.getMonth() + 1;
        this.day = date.getDate();
    }
    ShortDate.prototype.toMillis = function () {
        return new Date(this.year, this.month, this.day).getTime();
    };
    ShortDate.prototype.toISOString = function () {
        var y, m, d;
        y = this.year > 99 ? this.year.toString() : '20' + this.year;
        m = this.month > 9 ? this.month.toString() : '0' + this.month;
        d = this.day > 9 ? this.day.toString() : '0' + this.day;
        return y + '-' + m + '-' + d;
    };
    ShortDate.parse = function (str) {
        var d = new Date(str);
        return d && d.getFullYear() && d.getMonth && d.getDate() ? Result.success(new ShortDate(d)) : Result.fail(['Could not parse date: ' + str]);
    };
    return ShortDate;
})();
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
var Actions = (function () {
    function Actions(dispatcher) {
        this.dispatcher = dispatcher;
        var _this = this;
        $('#update-entries').click(function (evt) { return _this.updateEntries(); });
        $('#entry-container').keyup(function (evt) {
            evt.stopPropagation();
            evt.preventDefault();
            if (Actions.isEnter(evt)) {
                _this.updateEntries();
            }
        });
    }
    Actions.isEnter = function (evt) {
        return evt.keyCode === 13 && !evt.shiftKey && !evt.ctrlKey && !evt.metaKey && !evt.altKey;
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
var Time = (function () {
    function Time(hour, minute) {
        this.hour = hour;
        this.minute = minute;
    }
    Time.parse = function (str) {
        var regex = /^([0-9]|[0-1][0-9]|2[0-3]):?([0-5][0-9])$/, match = regex.exec(str), hour, minute;
        if (match) {
            hour = parseInt(match[1], 10);
            minute = parseInt(match[2], 10);
            return Result.success(new Time(hour, minute));
        }
        return Result.fail(['Cannot parse time: ' + str]);
    };
    Time.prototype.toMillis = function () {
        return this.hour * 3600 * 1000 + this.minute * 60 * 1000;
    };
    Time.prototype.toISOString = function () {
        var hourStr = (this.hour < 10 ? '0' : '') + this.hour, minuteStr = (this.minute < 10 ? '0' : '') + this.minute;
        return hourStr + ':' + minuteStr;
    };
    return Time;
})();
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
        time = Time.parse(raw.start);
        if (!time.isSuccess) {
            errs.push('Invalid time');
        }
        date = ShortDate.parse(raw.date);
        if (!date.isSuccess) {
            errs.push('Invalid date');
        }
        if (errs.length > 0) {
            return Validated.invalid(raw, errs);
        }
        return Validated.valid({
            project: raw.project,
            task: raw.task,
            start: time.value.toISOString(),
            date: date.value.toISOString()
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
var EntryCollection = (function (_super) {
    __extends(EntryCollection, _super);
    function EntryCollection(store) {
        _super.call(this);
        var _this = this;
        store.subscribe(function (su) { return _this.update(su.validated); });
    }
    EntryCollection.extractEntries = function (rawEntries) {
        var result = _.chain(rawEntries).map(function (r) {
            var dateRes = ShortDate.parse(r.date), timeRes = Time.parse(r.start);
            if (!dateRes || !timeRes) {
                throw new Error('Invalid datetime.');
            }
            return {
                project: r.project,
                task: r.task,
                date: dateRes.value,
                start: timeRes.value,
                end: undefined,
                startMillis: dateRes.value.toMillis() + timeRes.value.toMillis(),
                minutes: undefined
            };
        }).groupBy(function (r) { return r.date.toISOString(); }).values().map(function (day) {
            return _.chain(day).sortBy(function (r) { return r.startMillis; }).reduce(function (acc, r, i) {
                if (i === 0) {
                    return [r];
                }
                acc[i - 1].end = r.start;
                acc[i - 1].minutes = (acc[i - 1].end.toMillis() - acc[i - 1].start.toMillis()) / (60 * 1000);
                if (i !== rawEntries.length - 1) {
                    acc.push(r);
                }
                return acc;
            }, []).reduce(function (acc, r) {
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
            }, []).value();
        }).flatten();
        return result.value();
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
            var container = $('#entry-container');
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
                this.addBlankRow(evt.validated.length);
                container.find('.entry-row input.date:last').focus();
            }
            else {
                container.find('.entry-row.has-error input:first').focus();
            }
        };
        UserInput.prototype.addBlankRow = function (id) {
            var entries = $('#entry-container'), newRow = this.templates.find('#entry').clone();
            newRow.attr('id', 'entry-' + id);
            entries.append(newRow);
        };
        UserInput.prototype.fillRow = function (id, values) {
            var row = $('#entry-' + id);
            row.find('input.date').val(values['date']);
            row.find('input.project').val(values['project']);
            row.find('input.task').val(values['task']);
            row.find('input.start').val(values['start']);
            row.addClass('has-success');
            row.find('hr').removeClass('hidden');
            row.find('button.clear-row').removeClass('hidden').removeAttr('disabled').click(function (evt) { return row.find('input').val(null); });
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
            _.chain(entries).sortBy(function (e) { return e.task; }).sortBy(function (e) { return e.project; }).sortBy(function (e) { return e.date.toMillis(); }).each(function (e, i) {
                var newRow = templ.clone();
                newRow.attr('id', 'sum-' + i);
                newRow.find('.date').html(e.date.toISOString());
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
var projectChart = new ViewController.ProjectChart(ec);
var sumTable = new ViewController.SumTable(ec);
store.load();
