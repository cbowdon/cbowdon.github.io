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
var Test;
(function (Test) {
    QUnit.module('Entry');
    function sd(str) {
        var dateRes = ShortDate.parse(str);
        if (!dateRes.isSuccess) {
            throw new TypeError('Invalid short date in test.');
        }
        return dateRes.value;
    }
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
        result = _.chain(EntryCollection.extractEntries(raw)).sortBy(function (r) { return r.task; }).sortBy(function (r) { return r.project; }).each(function (r) { return r.date = r.date.toISOString(); }).value();
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
        result = _.chain(EntryCollection.extractEntries(raw)).sortBy(function (r) { return r.task; }).sortBy(function (r) { return r.project; }).each(function (r) { return r.date = r.date.toISOString(); }).sortBy(function (r) { return r.date; }).value();
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
})(Test || (Test = {}));
var Test;
(function (Test) {
    QUnit.module('ShortDate');
    function checkParse(name, input, shouldParse, message) {
        QUnit.test(name, function (assert) {
            var dateResult = ShortDate.parse(input), date;
            assert.strictEqual(dateResult.isSuccess, shouldParse, message || name);
        });
    }
    checkParse('Happy path', '2014-01-01', true);
    checkParse('Non-ISO month', '2014-1-01', false);
    checkParse('Non-ISO date', '2014-01-1', false);
    checkParse('Non-ISO month & date', '2014-1-1', false);
    checkParse('Non-ISO year', '14-01-01', false);
    checkParse('Non-ISO year & month', '14-1-01', false);
    checkParse('Non-ISO', '14-1-1', false);
    checkParse('Obviously wrong', 'Tasty peaches', false);
    function checkDateString(name, input, output, message) {
        QUnit.test(name, function (assert) {
            var dateResult = ShortDate.parse(input), date;
            assert.ok(dateResult.isSuccess, message);
            date = dateResult.value;
            assert.strictEqual(date.toISOString(), output, message || name);
        });
    }
    checkDateString('Happy path', '2014-01-01', '2014-01-01');
    checkDateString('12th month (no off-by-one)', '2014-12-31', '2014-12-31');
    checkDateString('A long time ago', '1987-10-24', '1987-10-24');
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
    QUnit.module('Time');
    QUnit.test('Parse string: HH:mm', function (assert) {
        var timeResult = Time.parse('23:45'), time;
        assert.ok(timeResult.isSuccess);
        time = timeResult.value;
        assert.strictEqual(time.minute, 45, 'minute');
        assert.strictEqual(time.hour, 23, 'hour');
    });
    QUnit.test('Parse string: HHmm', function (assert) {
        var timeResult = Time.parse('2345'), time;
        assert.ok(timeResult.isSuccess);
        time = timeResult.value;
        assert.strictEqual(time.minute, 45, 'minute');
        assert.strictEqual(time.hour, 23, 'hour');
    });
    QUnit.test('Parse string: H:mm', function (assert) {
        var timeResult = Time.parse('9:45'), time;
        assert.ok(timeResult.isSuccess);
        time = timeResult.value;
        assert.strictEqual(time.minute, 45, 'minute');
        assert.strictEqual(time.hour, 9, 'hour');
    });
    QUnit.test('Parse string: Hmm', function (assert) {
        var timeResult = Time.parse('945'), time;
        assert.ok(timeResult.isSuccess);
        time = timeResult.value;
        assert.strictEqual(time.minute, 45, 'minute');
        assert.strictEqual(time.hour, 9, 'hour');
    });
    QUnit.test('Midnight', function (assert) {
        var timeResult = Time.parse('0000'), time;
        assert.ok(timeResult.isSuccess);
        time = timeResult.value;
        assert.strictEqual(time.minute, 0, 'minute');
        assert.strictEqual(time.hour, 0, 'hour');
        assert.ok(!Time.parse('2400').isSuccess, '2400');
    });
    QUnit.test('Parse string: time out of range', function (assert) {
        assert.ok(!Time.parse('24:45').isSuccess, 'past midnight');
        assert.ok(!Time.parse('20:65').isSuccess, 'past the hour');
    });
    QUnit.test('To ISO string', function (assert) {
        function checkTimeString(input, output, message) {
            var timeResult = Time.parse(input), time;
            assert.ok(timeResult.isSuccess, message);
            time = timeResult.value;
            assert.strictEqual(time.toISOString(), output, message);
        }
        checkTimeString('9:45', '09:45');
        checkTimeString('945', '09:45');
        checkTimeString('0945', '09:45');
        checkTimeString('23:45', '23:45');
        checkTimeString('1200', '12:00');
    });
    QUnit.test('Millis', function (assert) {
        assert.strictEqual(new Time(0, 1).toMillis(), 60000);
        assert.strictEqual(new Time(1, 0).toMillis(), 3600000);
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
    QUnit.test('Validator bad time', function (assert) {
        var raw, result;
        raw = {
            project: 'Some project',
            task: 'Some task',
            date: '2014-07-30',
            start: '3028'
        };
        result = new RawEntryValidator().validate(raw);
        assert.ok(!result.isValid);
        assert.deepEqual(result.errors, ['Invalid time']);
    });
})(Test || (Test = {}));
