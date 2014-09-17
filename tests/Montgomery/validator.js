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
//# sourceMappingURL=validator.js.map