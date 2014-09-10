/// <reference path="../typings/tsd.d.ts" />
/// <reference path="../dist/tsmonad.d.ts" />
var TsMonad;
(function (TsMonad) {
    (function (Test) {
        'use strict';

        QUnit.module('Either');

        QUnit.test('Case of', function (assert) {
            assert.ok(TsMonad.Either.left('on noes').caseOf({
                left: function (s) {
                    return true;
                },
                right: function (n) {
                    return false;
                }
            }));

            assert.ok(TsMonad.Either.right(1).caseOf({
                left: function (s) {
                    return false;
                },
                right: function (n) {
                    return true;
                }
            }));
        });

        QUnit.test('Bind', function (assert) {
            assert.ok(TsMonad.Either.right(2).bind(function (n) {
                return TsMonad.Either.right(n * 2);
            }).bind(function (n) {
                return TsMonad.Either.right(n * 2);
            }).caseOf({
                left: function (s) {
                    return false;
                },
                right: function (n) {
                    return n === 8;
                }
            }));

            assert.ok(TsMonad.Either.right(2).bind(function (n) {
                return TsMonad.Either.right(n * 2);
            }).bind(function (n) {
                return TsMonad.Either.left('nooo');
            }).caseOf({
                left: function (s) {
                    return s === 'nooo';
                },
                right: function (n) {
                    return false;
                }
            }));
        });

        QUnit.test('Lift', function (assert) {
            assert.ok(TsMonad.Either.right(2).lift(function (n) {
                return n * 2;
            }).lift(function (n) {
                return n * 2;
            }).caseOf({
                left: function (s) {
                    return false;
                },
                right: function (n) {
                    return n === 8;
                }
            }));

            assert.ok(TsMonad.Either.right(2).lift(function (n) {
                return n * 2;
            }).lift(function (n) {
                return null;
            }).caseOf({
                left: function (s) {
                    return false;
                },
                right: function (n) {
                    return !n;
                }
            }));
        });
    })(TsMonad.Test || (TsMonad.Test = {}));
    var Test = TsMonad.Test;
})(TsMonad || (TsMonad = {}));
/// <reference path="../typings/tsd.d.ts" />
/// <reference path="../dist/tsmonad.d.ts" />
var TsMonad;
(function (TsMonad) {
    (function (Test) {
        'use strict';

        // TODO Automatically populate the README sections from the examples tests
        QUnit.module('Examples');

        QUnit.test('Pattern matching', function (assert) {
            var turns_out_to_be_100, turns_out_to_be_a_piano;

            turns_out_to_be_100 = TsMonad.Maybe.just(10).caseOf({
                just: function (n) {
                    return n * n;
                },
                nothing: function () {
                    return -1;
                }
            });

            assert.strictEqual(turns_out_to_be_100, 100);

            turns_out_to_be_a_piano = TsMonad.Maybe.nothing().caseOf({
                just: function (n) {
                    return n * n;
                },
                nothing: function () {
                    return -1;
                }
            });

            assert.strictEqual(turns_out_to_be_a_piano, -1);
            // The example that doesn't compile is not tested here, for obvious reasons. Exercise for the reader?
        });

        // <Test data definitions>
        var BusPass = (function () {
            function BusPass() {
            }
            BusPass.prototype.isValidForRoute = function (route) {
                return route === 'Weston';
            };
            return BusPass;
        })();

        // </Test data definitions>
        QUnit.test('General Maybe usage', function (assert) {
            var user, canRideForFree;

            function getBusPass(age) {
                return age > 100 ? TsMonad.Maybe.nothing() : TsMonad.Maybe.just(new BusPass());
            }

            user = { getAge: function () {
                    return TsMonad.Maybe.just(42);
                } };

            canRideForFree = user.getAge().bind(function (age) {
                return getBusPass(age);
            }).caseOf({
                just: function (busPass) {
                    return busPass.isValidForRoute('Weston');
                },
                nothing: function () {
                    return false;
                }
            });

            assert.ok(canRideForFree);
        });

        QUnit.test('General Either usage', function (assert) {
            var user, canRideForFree;

            function getBusPass(age) {
                return age > 100 ? TsMonad.Either.left('Too young for a bus pass') : TsMonad.Either.right(new BusPass());
            }

            user = { getAge: function () {
                    return TsMonad.Either.right(42);
                } };

            canRideForFree = user.getAge().bind(function (age) {
                return getBusPass(age);
            }).caseOf({
                right: function (busPass) {
                    return busPass.isValidForRoute('Weston');
                },
                left: function (errorMessage) {
                    console.log(errorMessage);
                    return false;
                }
            });

            assert.ok(canRideForFree);
        });

        QUnit.test('General Writer usage', function (assert) {
            assert.ok(TsMonad.Writer.writer(['Started with 0'], 0).bind(function (x) {
                return TsMonad.Writer.writer(['+ 8'], x + 8);
            }).bind(function (x) {
                return TsMonad.Writer.writer(['- 6', '* 8'], 8 * (x - 6));
            }).caseOf({
                writer: function (s, v) {
                    return v === 16 && s.join(', ') === 'Started with 0, + 8, - 6, * 8';
                }
            }));
        });

        QUnit.test('Lift/fmap', function (assert) {
            var turns_out_to_be_true = TsMonad.Maybe.just(123).lift(function (n) {
                return n * 2;
            }).caseOf({
                just: function (n) {
                    return n === 246;
                },
                nothing: function () {
                    return false;
                }
            });

            assert.ok(turns_out_to_be_true);
        });
    })(TsMonad.Test || (TsMonad.Test = {}));
    var Test = TsMonad.Test;
})(TsMonad || (TsMonad = {}));
/// <reference path="../typings/tsd.d.ts" />
/// <reference path="../dist/tsmonad.d.ts" />
var TsMonad;
(function (TsMonad) {
    (function (Test) {
        'use strict';

        QUnit.module('Maybe');

        QUnit.test('Case of', function (assert) {
            assert.ok(TsMonad.Maybe.just(10).caseOf({
                just: function (x) {
                    return true;
                },
                nothing: function () {
                    return false;
                }
            }));

            assert.ok(TsMonad.Maybe.nothing().caseOf({
                just: function (x) {
                    return false;
                },
                nothing: function () {
                    return true;
                }
            }));
        });

        QUnit.test('Bind', function (assert) {
            assert.ok(TsMonad.Maybe.just(2).bind(function (n) {
                return TsMonad.Maybe.just(n * 2);
            }).bind(function (n) {
                return TsMonad.Maybe.just(n * 2);
            }).caseOf({
                just: function (n) {
                    return n === 8;
                },
                nothing: function () {
                    return false;
                }
            }));

            assert.ok(TsMonad.Maybe.just(2).bind(function (n) {
                return TsMonad.Maybe.just(n * 2);
            }).bind(function (n) {
                return TsMonad.Maybe.nothing();
            }).caseOf({
                just: function (n) {
                    return false;
                },
                nothing: function () {
                    return true;
                }
            }));
        });

        QUnit.test('Lift', function (assert) {
            assert.ok(TsMonad.Maybe.just(2).lift(function (n) {
                return n * 2;
            }).lift(function (n) {
                return n * 2;
            }).caseOf({
                just: function (n) {
                    return n === 8;
                },
                nothing: function () {
                    return false;
                }
            }));

            assert.ok(TsMonad.Maybe.just(2).lift(function (n) {
                return n * 2;
            }).lift(function (n) {
                return null;
            }).caseOf({
                just: function (n) {
                    return false;
                },
                nothing: function () {
                    return true;
                }
            }));
        });

        QUnit.test('Constructors', function (assert) {
            assert.throws(function () {
                TsMonad.Maybe.just(null);
            }, /null/);

            assert.ok(TsMonad.Maybe.maybe(null).caseOf({
                just: function (s) {
                    return false;
                },
                nothing: function () {
                    return true;
                }
            }));

            assert.ok(TsMonad.Maybe.maybe('something').caseOf({
                just: function (s) {
                    return true;
                },
                nothing: function () {
                    return false;
                }
            }));
        });
    })(TsMonad.Test || (TsMonad.Test = {}));
    var Test = TsMonad.Test;
})(TsMonad || (TsMonad = {}));
/// <reference path="../typings/tsd.d.ts" />
/// <reference path="../dist/tsmonad.d.ts" />
var TsMonad;
(function (TsMonad) {
    (function (Test) {
        'use strict';

        QUnit.module('Type class laws');

        QUnit.test('Eq', function (assert) {
            // TODO auto generate all permutations given possible types
            assert.ok(TsMonad.Maybe.just(20).equals(TsMonad.Maybe.just(20)));
            assert.ok(!TsMonad.Maybe.just(20).equals(TsMonad.Maybe.just(10)));
            assert.ok(!TsMonad.Maybe.just(20).equals(TsMonad.Maybe.nothing()));
            assert.ok(TsMonad.Maybe.nothing().equals(TsMonad.Maybe.nothing()));

            assert.ok(TsMonad.Either.right(10).equals(TsMonad.Either.right(10)));
            assert.ok(!TsMonad.Either.right(10).equals(TsMonad.Either.right(20)));
            assert.ok(!TsMonad.Either.right(10).equals(TsMonad.Either.left('oook')));
            assert.ok(TsMonad.Either.left('oook').equals(TsMonad.Either.left('oook')));
        });

        // TODO is it worth making Monad extend Eq just to reduce the duplication here?
        QUnit.test('Functor 1: fmap id = id', function (assert) {
            _.each([TsMonad.Maybe.just(20), TsMonad.Maybe.nothing()], function (t) {
                return assert.ok(t.equals(t.fmap(function (x) {
                    return x;
                })));
            });

            _.each([TsMonad.Either.right(20), TsMonad.Either.left('oook')], function (t) {
                return assert.ok(t.equals(t.fmap(function (x) {
                    return x;
                })));
            });

            _.each([TsMonad.Writer.writer(['(^_^)'], 99)], function (t) {
                return assert.ok(t.equals(t.fmap(function (x) {
                    return x;
                })));
            });
        });

        QUnit.test('Functor 2: fmap (f . g) = fmap f . fmap g', function (assert) {
            var f = function (x) {
                return x * 2;
            }, g = function (x) {
                return x - 3;
            };

            _.each([TsMonad.Maybe.just(10), TsMonad.Maybe.nothing()], function (t) {
                var lhs = t.fmap(f).fmap(g), rhs = t.fmap(function (x) {
                    return g(f(x));
                });
                assert.ok(lhs.equals(rhs));
            });

            _.each([TsMonad.Either.right(10), TsMonad.Either.left('oook')], function (t) {
                var lhs = t.fmap(f).fmap(g), rhs = t.fmap(function (x) {
                    return g(f(x));
                });
                assert.ok(lhs.equals(rhs));
            });

            _.each([TsMonad.Writer.writer(['(^_^)'], 99)], function (t) {
                var lhs = t.fmap(f).fmap(g), rhs = t.fmap(function (x) {
                    return g(f(x));
                });
                assert.ok(lhs.equals(rhs));
            });
        });

        QUnit.test('Monad 1: left identity', function (assert) {
            // (return x >>= f) = f x
            var n = 10, fm = function (x) {
                return TsMonad.Maybe.just(2 * x);
            }, fe = function (x) {
                return TsMonad.Either.right(2 * x);
            }, fw = function (x) {
                return TsMonad.Writer.writer([n], 2 * n);
            };

            assert.ok(TsMonad.Maybe.maybe(n).bind(fm).equals(fm(n)));

            assert.ok(TsMonad.Either.right(n).bind(fe).equals(fe(n)));

            assert.ok(TsMonad.Writer.writer([], n).bind(fw).equals(fw(n)));
        });

        QUnit.test('Monad 2: right identity', function (assert) {
            // (m >>= return) = m
            var m = TsMonad.Maybe.just(20), e = TsMonad.Either.right(20), w = TsMonad.Writer.writer(['(^_^)'], 20);

            assert.ok(m.bind(m.unit).equals(m));

            assert.ok(e.bind(e.unit).equals(e));

            assert.ok(w.bind(w.unit).equals(w));
        });

        QUnit.test('Monad 3: associativity', function (assert) {
            // ((m >>= f) >>= g) = (m >>= (\x -> f x >>= g))
            var n = 10, m = TsMonad.Maybe.just(n), e = TsMonad.Either.right(n), w = TsMonad.Writer.writer([n], n), fm = function (x) {
                return TsMonad.Maybe.just(2 * x);
            }, gm = function (x) {
                return TsMonad.Maybe.just(x - 3);
            }, fe = function (x) {
                return TsMonad.Either.right(2 * x);
            }, ge = function (x) {
                return TsMonad.Either.right(x - 3);
            }, fw = function (x) {
                return TsMonad.Writer.writer([x], 2 * x);
            }, gw = function (x) {
                return TsMonad.Writer.writer([x], x - 3);
            };

            assert.ok(m.bind(fm).bind(gm).equals(m.bind(function (x) {
                return fm(x).bind(gm);
            })));

            assert.ok(e.bind(fe).bind(ge).equals(e.bind(function (x) {
                return fe(x).bind(ge);
            })));

            assert.ok(w.bind(fw).bind(gw).equals(w.bind(function (x) {
                return fw(x).bind(gw);
            })));
        });
    })(TsMonad.Test || (TsMonad.Test = {}));
    var Test = TsMonad.Test;
})(TsMonad || (TsMonad = {}));
/// <reference path="../typings/tsd.d.ts" />
/// <reference path="../dist/tsmonad.d.ts" />
var TsMonad;
(function (TsMonad) {
    (function (Test) {
        'use strict';

        QUnit.module('Writer');

        QUnit.test('Bind', function (assert) {
            assert.ok(TsMonad.Writer.tell(0).bind(function (x) {
                return TsMonad.Writer.writer([1, 0, 1], 'jazzy');
            }).equals(TsMonad.Writer.writer([0, 1, 0, 1], 'jazzy')));

            assert.ok(TsMonad.Writer.tell('This ').bind(function (x) {
                return TsMonad.Writer.writer(['is a '], [1, 2, 3]);
            }).bind(function (x) {
                return TsMonad.Writer.writer(['story'], 99);
            }).equals(TsMonad.Writer.writer(['This ', 'is a ', 'story'], 99)));
        });

        QUnit.test('Case of', function (assert) {
            assert.ok(TsMonad.Writer.tell('all about').caseOf({
                writer: function (s, v) {
                    return _.isEqual(s, ['all about']) && v === 0;
                }
            }));
        });

        QUnit.test('Lift', function (assert) {
            assert.ok(TsMonad.Writer.tell('how').lift(function (x) {
                return [0, 0, 0, 0];
            }).lift(function (x) {
                return 99;
            }).caseOf({
                writer: function (s, v) {
                    return _.isEqual(s, ['how']) && v === 99;
                }
            }));
        });
    })(TsMonad.Test || (TsMonad.Test = {}));
    var Test = TsMonad.Test;
})(TsMonad || (TsMonad = {}));
//# sourceMappingURL=tsmonad-test.js.map
