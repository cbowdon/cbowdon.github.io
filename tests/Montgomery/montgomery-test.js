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
var Test;
(function (Test) {
    QUnit.module('Entry');
    QUnit.test('Extract entries - single day', function (assert) {
        var raw, result;
        raw = [
            { project: 'P0', task: 'T0', date: '2014-08-18', start: '09:00' },
            { project: 'P0', task: 'T1', date: '2014-08-18', start: '10:15' },
            { project: 'P0', task: 'T0', date: '2014-08-18', start: '11:15' },
            { project: 'P1', task: 'T0', date: '2014-08-18', start: '12:15' },
            { project: 'P1', task: 'T0', date: '2014-08-18', start: '13:15' },
            { project: 'Lunch', date: '2014-08-18', start: '13:45' },
            { project: 'P0', task: 'T0', date: '2014-08-18', start: '14:15' },
            { project: 'Home', date: '2014-08-18', start: '17:00' }
        ];
        result = _.chain(EntryCollection.extractEntries(raw)).sortBy(function (r) { return r.task; }).sortBy(function (r) { return r.project; }).map(function (r) {
            return { date: r.date.format('YYYY-MM-DD'), project: r.project, task: r.task, minutes: r.minutes };
        }).value();
        assert.deepEqual(result, [
            { date: '2014-08-18', project: 'P0', task: 'T0', minutes: 300 },
            { date: '2014-08-18', project: 'P0', task: 'T1', minutes: 60 },
            { date: '2014-08-18', project: 'P1', task: 'T0', minutes: 90 }
        ]);
        assert.strictEqual(_.reduce(result, function (acc, r) { return acc + r.minutes; }, 0), 450, 'Expect a 7.5 hour day');
    });
    QUnit.test('Extract entries - multiple days', function (assert) {
        var raw, result;
        raw = [
            { project: 'P0', task: 'T0', date: '2014-08-18', start: '09:00' },
            { project: 'lunch', date: '2014-08-18', start: '12:30' },
            { project: 'P0', task: 'T0', date: '2014-08-18', start: '13:00' },
            { project: 'Home', date: '2014-08-18', start: '17:00' },
            { project: 'P0', task: 'T0', date: '2014-08-19', start: '09:00' },
            { project: 'P0', task: 'T1', date: '2014-08-19', start: '10:15' },
            { project: 'lunch', date: '2014-08-19', start: '12:30' },
            { project: 'P0', task: 'T1', date: '2014-08-19', start: '13:00' },
            { project: 'Home', date: '2014-08-19', start: '17:00' },
            { project: 'P0', task: 'T0', date: '2014-08-20', start: '09:00' },
            { project: 'P0', task: 'T1', date: '2014-08-20', start: '11:00' },
            { project: 'P1', task: 'T0', date: '2014-08-20', start: '11:15' },
            { project: 'lunch', date: '2014-08-20', start: '12:30' },
            { project: 'P1', task: 'T0', date: '2014-08-20', start: '13:00' },
            { project: 'Home', date: '2014-08-20', start: '17:00' }
        ];
        result = _.chain(EntryCollection.extractEntries(raw)).sortBy(function (r) { return r.task; }).sortBy(function (r) { return r.project; }).map(function (r) {
            return { date: r.date.format('YYYY-MM-DD'), project: r.project, task: r.task, minutes: r.minutes };
        }).sortBy(function (r) { return r.date; }).value();
        assert.deepEqual(result, [
            { date: '2014-08-18', project: 'P0', task: 'T0', minutes: 450 },
            { date: '2014-08-19', project: 'P0', task: 'T0', minutes: 75 },
            { date: '2014-08-19', project: 'P0', task: 'T1', minutes: 375 },
            { date: '2014-08-20', project: 'P0', task: 'T0', minutes: 120 },
            { date: '2014-08-20', project: 'P0', task: 'T1', minutes: 15 },
            { date: '2014-08-20', project: 'P1', task: 'T0', minutes: 315 },
        ]);
        assert.strictEqual(_.reduce(result, function (acc, r) { return acc + r.minutes; }, 0), 3 * 450, 'Expect three 7.5 hour days');
    });
    QUnit.test('Extract entries - first entry of second day', function (assert) {
        var raw, result;
        raw = [
            { project: 'P0', task: 'T0', date: '2014-08-18', start: '09:00' },
            { project: 'lunch', date: '2014-08-18', start: '12:30' },
            { project: 'P0', task: 'T0', date: '2014-08-18', start: '13:00' },
            { project: 'Home', date: '2014-08-18', start: '17:00' },
            { project: 'P0', task: 'T0', date: '2014-08-19', start: '09:00' },
        ];
        result = _.chain(EntryCollection.extractEntries(raw)).sortBy(function (r) { return r.task; }).sortBy(function (r) { return r.project; }).map(function (r) {
            return { date: r.date.format('YYYY-MM-DD'), project: r.project, task: r.task, minutes: r.minutes };
        }).sortBy(function (r) { return r.date; }).value();
        assert.deepEqual(result, [
            { date: '2014-08-18', project: 'P0', task: 'T0', minutes: 450 },
        ]);
        assert.strictEqual(_.reduce(result, function (acc, r) { return acc + r.minutes; }, 0), 1 * 450, 'Expect one 7.5 hour days');
    });
})(Test || (Test = {}));
var Test;
(function (Test) {
    QUnit.module('Store');
    QUnit.test('Store publishes updates', function (assert) {
        var dispatcher = new Dispatcher(), store = new Store(dispatcher), rawEntry = { project: 'Test', task: 'Does it?', start: '20:30', date: '2014-07-29' }, didPublish = false;
        store.subscribe(function (evt) { return didPublish = !!evt.validated; });
        dispatcher.dispatch('entry', rawEntry);
        assert.ok(didPublish, 'Expected update published');
    });
})(Test || (Test = {}));
var Test;
(function (Test) {
    QUnit.module('Validator');
    QUnit.test('Validator happy path', function (assert) {
        var raw, result;
        raw = {
            project: 'Some project',
            task: 'Some task',
            date: '2014-07-30',
            start: '2028'
        };
        result = new RawEntryValidator().validate(raw);
        assert.ok(result.isValid);
        assert.deepEqual(result.value, {
            project: raw.project,
            task: raw.task,
            date: '2014-07-30',
            start: '20:28'
        });
    });
    QUnit.test('Validator bad date', function (assert) {
        var raw, result, validator = new RawEntryValidator();
        raw = {
            project: 'Some project',
            task: 'Some task',
            date: '2014',
            start: '2028'
        };
        result = validator.validate(raw);
        assert.ok(!result.isValid);
        assert.deepEqual(result.errors, ['Invalid date']);
    });
    QUnit.test('Validator bad time', function (assert) {
        var raw, result, validator = new RawEntryValidator();
        raw = {
            project: 'Some project',
            task: 'Some task',
            date: '2014-07-30',
            start: '3028'
        };
        result = validator.validate(raw);
        assert.ok(!result.isValid);
        assert.deepEqual(result.errors, ['Invalid time']);
    });
})(Test || (Test = {}));
//# sourceMappingURL=montgomery-test.js.map