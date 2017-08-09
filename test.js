const assert = require('chai').assert;
const EventEmitter = require('events').EventEmitter;
const schedule = require('node-schedule');
const lolex = require('lolex');
const moment = require('moment-timezone');

const Bot = require('./bot');

class MockBackend extends EventEmitter {
    constructor() {
        super()

        this._receivedMessages = {}
    }

    onTextMessage(func) {
        this.on('text-message', func);
    }

    onStartChattingMessage(func) {
        this.on('start-chatting', func);
    }

    send(message, recipient) {
        if (!this._receivedMessages[recipient])
            this._receivedMessages[recipient] = [];

        this._receivedMessages[recipient] = this._receivedMessages[recipient].concat(message);

        return Promise.resolve(null);
    }

    getUserProfile(nickname) {
        return Promise.resolve({
            displayName: 'Mock User',
            username: nickname,
            firstName: 'Mock',
            lastName: 'User',
            profilePicUrl: 'http://example.com/',
            profilePicLastModified: 0,
            timezone: 'Europe/London'
        });
    }

    _fakeMessage(text, sender) {
        let message = {
            body: text,
            from: sender,
            reply: msg => this.send(msg, sender)
        };
        this.emit('text-message', message);
    }

    _fakeStartChatting(sender) {
        let message = {
            body: null,
            from: sender,
            reply: message => this.send(message, sender)
        };
        this.emit('start-chatting', message);
    }

    _lastReceived(recipient) {
        if (!this._receivedMessages[recipient] || !this._receivedMessages[recipient].length) {
            return null;
        } else {
            return this._receivedMessages[recipient].slice(-1).pop();
        }
    }
}

const nullSchedule = {
    scheduleJob() { /* NOP */ }
};


function continueImmediate(func) {
    return new Promise((resolve, reject) => {
        setImmediate(() => {
            try {
                resolve(func());
            } catch (e) {
                reject(e);
            }
        })
    });
}

suite('Welcome Message', function() {
    test('receiving welcome message', function() {
        let config = {username:'mockbot'};
        let texts = {};
        let backend = new MockBackend();
        let bot = new Bot({config:config, texts:texts, backend:backend, schedule:nullSchedule, debug:()=>{}});
        bot.start();

        backend._fakeStartChatting('blub');

        return continueImmediate(() => {
            assert.isOk(backend._lastReceived('blub'));
        });
    });
});

suite('Messages on demand', function() {
    let config = {
        username: 'mockbot',
        recipients: ['sweetie', 'bitch'],
        recipient_modes: { 'bitch': 'insult' },
        persist() { /*TODO*/ }
    };
    let texts = {
        sweet: {
            morning: ['sweet morning #1', 'sweet morning #2', 'sweet morning #3'],
            night: ['sweet night #1', 'sweet night #2', 'sweet night #3']
        },
        insult: {
            morning: ['insulting morning #1', 'insulting morning #2', 'insulting morning #3'],
            night: ['insulting night #1', 'insulting night #2', 'insulting night #3']
        }
    };
    let backend = new MockBackend();
    let bot = new Bot({config:config, texts:texts, backend:backend, schedule:nullSchedule, debug:()=>{}});
    bot.start();

    test('Sweet Text #1', function() {
        let oldTexts = [].concat(config.texts_sent && config.texts_sent['sweetie'] ? config.texts_sent['sweetie'] : []);
        backend._fakeMessage('Hello', 'sweetie');

        return continueImmediate(() => {
            assert.include(texts.sweet.morning, backend._lastReceived('sweetie'));
            assert.equal(backend._lastReceived('sweetie'), config.texts_sent['sweetie'].slice(-1)[0]);
            assert.notInclude(oldTexts, backend._lastReceived('sweetie'));
        });
    });

    test('Sweet Text #2', function() {
        let oldTexts = [].concat(config.texts_sent && config.texts_sent['sweetie'] ? config.texts_sent['sweetie'] : []);
        backend._fakeMessage('Hello again!', 'sweetie');

        return continueImmediate(() => {
            assert.include(texts.sweet.morning, backend._lastReceived('sweetie'));
            assert.equal(backend._lastReceived('sweetie'), config.texts_sent['sweetie'].slice(-1)[0]);
            assert.notInclude(oldTexts, backend._lastReceived('sweetie'));
        });
    });

    test('Sweet Night #1', function() {
        let oldTexts = [].concat(config.night_texts_sent && config.night_texts_sent['sweetie'] ?
            config.night_texts_sent['sweetie'] : []);
        backend._fakeMessage('Good night!', 'sweetie');

        return continueImmediate(() => {
            assert.include(texts.sweet.night, backend._lastReceived('sweetie'));
            assert.equal(backend._lastReceived('sweetie'), config.night_texts_sent['sweetie'].slice(-1)[0]);
            assert.notInclude(oldTexts, backend._lastReceived('sweetie'));
        });
    });

    test('Sweet Night #2', function() {
        let oldTexts = [].concat(config.night_texts_sent && config.night_texts_sent['sweetie'] ?
            config.night_texts_sent['sweetie'] : []);
        backend._fakeMessage('Good night!', 'sweetie');

        return continueImmediate(() => {
            assert.include(texts.sweet.night, backend._lastReceived('sweetie'));
            assert.equal(backend._lastReceived('sweetie'), config.night_texts_sent['sweetie'].slice(-1)[0]);
            assert.notInclude(oldTexts, backend._lastReceived('sweetie'));
        });
    });

    test('Insulting Text #1', function() {
        let oldTexts = [].concat(config.texts_sent && config.texts_sent['bitch'] ? config.texts_sent['bitch'] : []);
        backend._fakeMessage('Hello', 'bitch');

        return continueImmediate(() => {
            assert.include(texts.insult.morning, backend._lastReceived('bitch'));
            assert.equal(backend._lastReceived('bitch'), config.texts_sent['bitch'].slice(-1)[0]);
            assert.notInclude(oldTexts, backend._lastReceived('bitch'));
        });
    });

    test('Insulting Text #2', function() {
        let oldTexts = [].concat(config.texts_sent && config.texts_sent['bitch'] ? config.texts_sent['bitch'] : []);
        backend._fakeMessage('Hello', 'bitch');

        return continueImmediate(() => {
            assert.include(texts.insult.morning, backend._lastReceived('bitch'));
            assert.equal(backend._lastReceived('bitch'), config.texts_sent['bitch'].slice(-1)[0]);
            assert.notInclude(oldTexts, backend._lastReceived('bitch'));
        });
    });

    test('Insulting Night #1', function() {
        let oldTexts = [].concat(config.night_texts_sent && config.night_texts_sent['bitch'] ?
            config.night_texts_sent['bitch'] : []);
        backend._fakeMessage('Good night!', 'bitch');

        return continueImmediate(() => {
            assert.include(texts.insult.night, backend._lastReceived('bitch'));
            assert.equal(backend._lastReceived('bitch'), config.night_texts_sent['bitch'].slice(-1)[0]);
            assert.notInclude(oldTexts, backend._lastReceived('bitch'));
        });
    });

    test('Insulting Night #2', function() {
        let oldTexts = [].concat(config.night_texts_sent && config.night_texts_sent['bitch'] ?
            config.night_texts_sent['bitch'] : []);
        backend._fakeMessage('Good night!', 'bitch');

        return continueImmediate(() => {
            assert.include(texts.insult.night, backend._lastReceived('bitch'));
            assert.equal(backend._lastReceived('bitch'), config.night_texts_sent['bitch'].slice(-1)[0]);
            assert.notInclude(oldTexts, backend._lastReceived('bitch'));
        });
    });
});

suite('Messages on time', function() {
    let config = {
        username: 'mockbot',
        recipients: ['sweetie', 'bitch'],
        recipient_modes: { 'bitch': 'insult' },
        persist() { /*TODO*/ }
    };
    let texts = {
        sweet: {
            morning: ['sweet morning #1', 'sweet morning #2', 'sweet morning #3'],
            night: ['sweet night #1', 'sweet night #2', 'sweet night #3']
        },
        insult: {
            morning: ['insulting morning #1', 'insulting morning #2', 'insulting morning #3'],
            night: ['insulting night #1', 'insulting night #2', 'insulting night #3']
        }
    };

    let clock = null;

    test('sweet morning text', function() {
        clock = lolex.install(moment.tz('2017-08-09 06:59:59', 'Europe/Berlin').toDate());
        let backend = new MockBackend();
        let bot = new Bot({config:config, texts:texts, backend:backend, schedule:schedule, debug:()=>{}});
        bot.start();

        clock.tick('01:01:00');

        assert.include(texts.sweet.morning, backend._lastReceived('sweetie'));
    });

    test('insulting morning text', function() {
        clock = lolex.install(moment.tz('2017-08-09 06:59:59', 'Europe/Berlin').toDate());
        let backend = new MockBackend();
        let bot = new Bot({config:config, texts:texts, backend:backend, schedule:schedule, debug:()=>{}});
        bot.start();

        clock.tick('01:01:00');

        assert.include(texts.insult.morning, backend._lastReceived('bitch'));
    });

    test('sweet night text', function() {
        clock = lolex.install(moment.tz('2017-08-09 19:59:59', 'Europe/Berlin').toDate());
        let backend = new MockBackend();
        let bot = new Bot({config:config, texts:texts, backend:backend, schedule:schedule, debug:()=>{}});
        bot.start();

        clock.tick('02:01:00');

        assert.include(texts.sweet.night, backend._lastReceived('sweetie'));
    });

    test('insulting night text', function() {
        clock = lolex.install(moment.tz('2017-08-09 19:59:59', 'Europe/Berlin').toDate());
        let backend = new MockBackend();
        let bot = new Bot({config:config, texts:texts, backend:backend, schedule:schedule, debug:()=>{}});
        bot.start();

        clock.tick('02:01:00');

        assert.include(texts.insult.night, backend._lastReceived('bitch'));
    });

    afterEach(function() {
        for (let name in schedule.scheduledJobs) {
            schedule.scheduledJobs[name].cancel();
        }

        if (clock) {
            clock.uninstall();
            clock = null;
        }
    });
});

suite('Switch modes', function() {
    let config = {
        username: 'mockbot',
        recipients: ['sweetie', 'bitch'],
        recipient_modes: { 'bitch': 'insult' },
        persist() { /*TODO*/ }
    };
    let texts = {
        sweet: {
            morning: ['sweet morning #1', 'sweet morning #2', 'sweet morning #3'],
            night: ['sweet night #1', 'sweet night #2', 'sweet night #3']
        },
        insult: {
            morning: ['insulting morning #1', 'insulting morning #2', 'insulting morning #3'],
            night: ['insulting night #1', 'insulting night #2', 'insulting night #3']
        }
    };
    let backend = new MockBackend();
    let bot = new Bot({config:config, texts:texts, backend:backend, schedule:nullSchedule, debug:()=>{}});
    bot.start();

    test('switching sweetie to insult mode', function() {
        backend._fakeMessage('Hello', 'sweetie');

        return continueImmediate(() => {
            assert.include(texts.sweet.morning, backend._lastReceived('sweetie'));

            backend._fakeMessage('be naughty to me', 'sweetie');
            backend._fakeMessage('give it to me', 'sweetie');
            return continueImmediate(() => {
                assert.include(texts.insult.morning, backend._lastReceived('sweetie'));
            });
        });
    });

    test('switching bitch to sweet mode', function() {
        backend._fakeMessage('Hello', 'bitch');

        return continueImmediate(() => {
            assert.include(texts.insult.morning, backend._lastReceived('bitch'));

            backend._fakeMessage('be nice to me', 'bitch');
            backend._fakeMessage('give it to me', 'bitch');
            return continueImmediate(() => {
                assert.include(texts.sweet.morning, backend._lastReceived('bitch'));
            });
        });
    });

    test('switch while in message delay at morning', function() {
        let clock = lolex.install(moment.tz('2017-12-24 06:59:59', 'Europe/Berlin').toDate());
        try {
            config.recipient_modes['sweetie'] = 'sweet';
            config.texts_sent = [];
            let backend = new MockBackend();
            let bot = new Bot({config:config, texts:texts, backend:backend, schedule:schedule, debug:()=>{}});
            bot.start();

            clock.tick('00:00:02');
            backend._fakeMessage('be naughty to me', 'sweetie');
            clock.tick('01:01:00');

            assert.include(texts.insult.morning, backend._lastReceived('sweetie'));
            assert.isNotNull(backend._lastReceived('sweetie'));
        } finally {
            clock.uninstall();
        }
    });

    test('switch while in message delay at night', function() {
        let clock = lolex.install(moment.tz('2017-12-24 19:59:59', 'Europe/Berlin').toDate());
        try {
            config.recipient_modes['sweetie'] = 'sweet';
            config.night_texts_sent = [];
            let backend = new MockBackend();
            let bot = new Bot({config:config, texts:texts, backend:backend, schedule:schedule, debug:()=>{}});
            bot.start();

            clock.tick('00:00:02');
            backend._fakeMessage('be naughty to me', 'sweetie');
            clock.tick('02:01:00');

            assert.include(texts.insult.night, backend._lastReceived('sweetie'));
            assert.isNotNull(backend._lastReceived('sweetie'));
        } finally {
            clock.uninstall();
        }
    });
});

suite('Special Messages', function() {
    let config = {
        username: 'mockbot',
        recipients: ['sweetie', 'bitch', 'sunny3964'],
        recipient_modes: { 'bitch': 'insult' },
        persist() { /*TODO*/ }
    };
    let texts = {
        sweet: {
            morning: ['sweet morning #1', 'sweet morning #2', 'sweet morning #3'],
            night: ['sweet night #1', 'sweet night #2', 'sweet night #3']
        },
        insult: {
            morning: ['insulting morning #1', 'insulting morning #2', 'insulting morning #3'],
            night: ['insulting night #1', 'insulting night #2', 'insulting night #3']
        }
    };
    let clock = null;

    test('Christmas Special 2017', function() {
        clock = lolex.install(moment.tz('2017-12-24 17:59:59', 'Europe/Berlin').toDate());
        let backend = new MockBackend();
        let bot = new Bot({config:config, texts:texts, backend:backend, schedule:schedule, debug:()=>{}});
        bot.start();

        clock.tick('01:01:00');

        assert.notInclude(texts.sweet.morning, backend._lastReceived('sweetie'));
        assert.notInclude(texts.sweet.night, backend._lastReceived('sweetie'));
        assert.isNotNull(backend._lastReceived('sweetie'));
    });

    test('Christmas Special 2018', function() {
        clock = lolex.install(moment.tz('2018-12-24 17:59:59', 'Europe/Berlin').toDate());
        let backend = new MockBackend();
        let bot = new Bot({config:config, texts:texts, backend:backend, schedule:schedule, debug:()=>{}});
        bot.start();

        clock.tick('01:01:00');

        assert.notInclude(texts.sweet.morning, backend._lastReceived('sweetie'));
        assert.notInclude(texts.sweet.night, backend._lastReceived('sweetie'));
        assert.isNotNull(backend._lastReceived('sweetie'));
    });

    test('New Year Special 2018', function() {
        clock = lolex.install(moment.tz('2017-12-31 23:00:00', 'Europe/Berlin').toDate());
        let backend = new MockBackend();
        let bot = new Bot({config:config, texts:texts, backend:backend, schedule:schedule, debug:()=>{}});
        bot.start();

        clock.tick('02:01:00');

        assert.notInclude(texts.sweet.morning, backend._lastReceived('sweetie'));
        assert.notInclude(texts.sweet.night, backend._lastReceived('sweetie'));
        assert.isNotNull(backend._lastReceived('sweetie'));
    });

    test('Birthday Special 2017 for sunny', function() {
        clock = lolex.install(moment.tz('2017-12-10 06:59:59', 'Europe/Berlin').toDate());
        let backend = new MockBackend();
        let bot = new Bot({config:config, texts:texts, backend:backend, schedule:schedule, debug:()=>{}});
        bot.start();

        clock.tick('02:01:00');

        assert.notInclude(texts.sweet.morning, backend._lastReceived('sunny3964'));
        assert.notInclude(texts.sweet.night, backend._lastReceived('sunny3964'));
        assert.isNotNull(backend._lastReceived('sunny3964'));
    })

    afterEach(function() {
        for (let name in schedule.scheduledJobs) {
            schedule.scheduledJobs[name].cancel();
        }

        if (clock) {
            clock.uninstall();
            clock = null;
        }
    });
});
