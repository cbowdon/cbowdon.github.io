var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
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
//# sourceMappingURL=entry.js.map