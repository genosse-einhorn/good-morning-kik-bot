const assert = require('chai').assert;
const EventEmitter = require('events').EventEmitter;
const realCron = require('cron-scheduler');
const lolex = require('lolex');
const moment = require('moment-timezone');

const Bot = require('./bot');

class MockBackend extends EventEmitter {
    constructor() {
        super();

        this._receivedMessages = {};
        this._userProfiles = {};
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
        if (this._userProfiles[nickname]) {
            return Promise.resolve(this._userProfiles[nickname]);
        } else {
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

const nullCron = function() {};
const cron = function() {
    cron.jobs.push(realCron.apply(this, arguments));
}
cron.jobs = [];
cron.cancelAll = function() {
    cron.jobs.forEach(j => j.stop());
    cron.jobs = [];
}



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
        let bot = new Bot({config:config, texts:texts, backend:backend, cron:nullCron, debug:()=>{}});
        bot.start();

        backend._fakeStartChatting('blub');

        return continueImmediate(() => {
            assert.isOk(backend._lastReceived('blub'));
        });
    });

    test('setting timezone based on kik data - LA', function() {
        let config = {username:'mockbot', persist(){}};
        let texts = {'sweet':{'morning':['x'], 'night':['x']}};
        let backend = new MockBackend();
        backend._userProfiles['pacific-sunshine'] = {
                displayName: 'Mock User',
                username: 'pacific-sunshine',
                firstName: 'Mock',
                lastName: 'User',
                profilePicUrl: 'http://example.com/',
                profilePicLastModified: 0,
                timezone: 'America/New_York'
            }

        let bot = new Bot({config:config, texts:texts, backend:backend, cron:nullCron, debug:()=>{}});
        bot.start();

        backend._fakeMessage('Hello', 'pacific-sunshine');

        return continueImmediate(() => {
            assert.isOk(backend._lastReceived('pacific-sunshine'));
            assert.equal(config.recipient_timezones['pacific-sunshine'], 'la');
        });
    });

    test('setting timezone based on kik data - DE', function() {
        let config = {username:'mockbot', persist(){}};
        let texts = {'sweet':{'morning':['x'], 'night':['x']}};
        let backend = new MockBackend();
        backend._userProfiles['european-sunshine'] = {
                displayName: 'Mock User',
                username: 'european-sunshine',
                firstName: 'Mock',
                lastName: 'User',
                profilePicUrl: 'http://example.com/',
                profilePicLastModified: 0,
                timezone: 'Europe/Berlin'
            }

        let bot = new Bot({config:config, texts:texts, backend:backend, cron:nullCron, debug:()=>{}});
        bot.start();

        backend._fakeMessage('Hello', 'european-sunshine');

        return continueImmediate(() => {
            assert.isOk(backend._lastReceived('european-sunshine'));
            assert.equal(config.recipient_timezones['european-sunshine'], 'de');
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
    let bot = new Bot({config:config, texts:texts, backend:backend, cron:nullCron, debug:()=>{}});
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
        recipients: ['sweetie', 'bitch', 'la-sweetie', 'la-bitch'],
        recipient_modes: { 'bitch': 'insult', 'la-bitch': 'insult' },
        recipient_timezones: { 'la-sweetie': 'la', 'la-bitch': 'la' },
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
        let bot = new Bot({config:config, texts:texts, backend:backend, cron:cron, debug:()=>{}});
        bot.start();

        clock.tick('01:01:00');

        assert.include(texts.sweet.morning, backend._lastReceived('sweetie'));
    });

    test('insulting morning text', function() {
        clock = lolex.install(moment.tz('2017-08-09 06:59:59', 'Europe/Berlin').toDate());
        let backend = new MockBackend();
        let bot = new Bot({config:config, texts:texts, backend:backend, cron:cron, debug:()=>{}});
        bot.start();

        clock.tick('01:01:00');

        assert.include(texts.insult.morning, backend._lastReceived('bitch'));
    });

    test('sweet night text', function() {
        clock = lolex.install(moment.tz('2017-08-09 19:59:59', 'Europe/Berlin').toDate());
        let backend = new MockBackend();
        let bot = new Bot({config:config, texts:texts, backend:backend, cron:cron, debug:()=>{}});
        bot.start();

        clock.tick('02:01:00');

        assert.include(texts.sweet.night, backend._lastReceived('sweetie'));
    });

    test('insulting night text', function() {
        clock = lolex.install(moment.tz('2017-08-09 19:59:59', 'Europe/Berlin').toDate());
        let backend = new MockBackend();
        let bot = new Bot({config:config, texts:texts, backend:backend, cron:cron, debug:()=>{}});
        bot.start();

        clock.tick('02:01:00');

        assert.include(texts.insult.night, backend._lastReceived('bitch'));
    });

    test('sweet morning text in LA (positive test)', function() {
        clock = lolex.install(moment.tz('2017-08-09 06:59:59', 'America/Los_Angeles').toDate());
        let backend = new MockBackend();
        let bot = new Bot({config:config, texts:texts, backend:backend, cron:cron, debug:()=>{}});
        bot.start();

        clock.tick('01:01:00');

        assert.include(texts.sweet.morning, backend._lastReceived('la-sweetie'));
    });

    test('sweet morning text in LA (negative test #1)', function() {
        // here we test that we DON'T receive a message when it's european morning
        clock = lolex.install(moment.tz('2017-08-09 06:59:59', 'Europe/Berlin').toDate());
        let backend = new MockBackend();
        let bot = new Bot({config:config, texts:texts, backend:backend, cron:cron, debug:()=>{}});
        bot.start();

        config.texts_sent['la-sweetie'] = [];

        clock.tick('01:01:00');

        assert.isNull(backend._lastReceived('la-sweetie'));
    });

    test('sweet morning text in LA (negative test #2)', function() {
        // here we test that european sweetie won't receive a message on LA sunrise
        clock = lolex.install(moment.tz('2017-08-09 06:59:59', 'America/Los_Angeles').toDate());
        let backend = new MockBackend();
        let bot = new Bot({config:config, texts:texts, backend:backend, cron:cron, debug:()=>{}});
        bot.start();

        config.texts_sent['sweetie'] = [];

        clock.tick('01:01:00');

        assert.isNull(backend._lastReceived('sweetie'));
    });

    test('insulting evening text in LA (positive test)', function() {
        clock = lolex.install(moment.tz('2017-08-09 19:59:59', 'America/Los_Angeles').toDate());
        let backend = new MockBackend();
        let bot = new Bot({config:config, texts:texts, backend:backend, cron:cron, debug:()=>{}});
        bot.start();

        clock.tick('02:01:00');

        assert.include(texts.insult.night, backend._lastReceived('la-bitch'));
    });

    test('insulting evening text in LA (negative test #1)', function() {
        // here we test that we DON'T receive a message when it's european evening
        clock = lolex.install(moment.tz('2017-08-09 19:59:59', 'Europe/Berlin').toDate());
        let backend = new MockBackend();
        let bot = new Bot({config:config, texts:texts, backend:backend, cron:cron, debug:()=>{}});
        bot.start();

        config.texts_sent['la-bitch'] = [];

        clock.tick('02:01:00');

        assert.isNull(backend._lastReceived('la-bitch'));
    });

    test('insulting evening text in LA (negative test #2)', function() {
        // here we test that european sweetie won't receive a message on LA sunset
        clock = lolex.install(moment.tz('2017-08-09 19:59:59', 'America/Los_Angeles').toDate());
        let backend = new MockBackend();
        let bot = new Bot({config:config, texts:texts, backend:backend, cron:cron, debug:()=>{}});
        bot.start();

        config.texts_sent['bitch'] = [];

        clock.tick('02:01:00');

        assert.isNull(backend._lastReceived('bitch'));
    });

    afterEach(function() {
        cron.cancelAll();

        if (clock) {
            clock.uninstall();
            clock = null;
        }
    });
});

suite('Commands', function() {
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
    let bot = new Bot({config:config, texts:texts, backend:backend, cron:nullCron, debug:()=>{}});
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
            let bot = new Bot({config:config, texts:texts, backend:backend, cron:cron, debug:()=>{}});
            bot.start();

            clock.tick('00:00:02');
            backend._fakeMessage('be naughty to me', 'sweetie');
            clock.tick('01:01:00');

            assert.include(texts.insult.morning, backend._lastReceived('sweetie'));
            assert.isNotNull(backend._lastReceived('sweetie'));
        } finally {
            clock.uninstall();
            cron.cancelAll();
        }
    });

    test('switch while in message delay at night', function() {
        let clock = lolex.install(moment.tz('2017-12-24 19:59:59', 'Europe/Berlin').toDate());
        try {
            config.recipient_modes['sweetie'] = 'sweet';
            config.night_texts_sent = [];
            let backend = new MockBackend();
            let bot = new Bot({config:config, texts:texts, backend:backend, cron:cron, debug:()=>{}});
            bot.start();

            clock.tick('00:00:02');
            backend._fakeMessage('be naughty to me', 'sweetie');
            clock.tick('02:01:00');

            assert.include(texts.insult.night, backend._lastReceived('sweetie'));
            assert.isNotNull(backend._lastReceived('sweetie'));
        } finally {
            clock.uninstall();
            cron.cancelAll();
        }
    });

    test('leave the bot', function() {
        config.recipients.push('blub');
        backend._fakeMessage('leave me alone', 'blub');

        return continueImmediate(() => {
            assert.notInclude(config.recipients, 'blub');
        });
    });

    test('get timezone', function() {
        backend._fakeMessage('What is my timezone?', 'sweetie');

        return continueImmediate(() => {
            assert.match(backend._lastReceived('sweetie'), /Europe\/London/);
        });
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
        let bot = new Bot({config:config, texts:texts, backend:backend, cron:cron, debug:()=>{}});
        bot.start();

        clock.tick('01:01:00');

        assert.notInclude(texts.sweet.morning, backend._lastReceived('sweetie'));
        assert.notInclude(texts.sweet.night, backend._lastReceived('sweetie'));
        assert.isNotNull(backend._lastReceived('sweetie'));
    });

    test('Christmas Special 2018', function() {
        clock = lolex.install(moment.tz('2018-12-24 17:59:59', 'Europe/Berlin').toDate());
        let backend = new MockBackend();
        let bot = new Bot({config:config, texts:texts, backend:backend, cron:cron, debug:()=>{}});
        bot.start();

        clock.tick('01:01:00');

        assert.notInclude(texts.sweet.morning, backend._lastReceived('sweetie'));
        assert.notInclude(texts.sweet.night, backend._lastReceived('sweetie'));
        assert.isNotNull(backend._lastReceived('sweetie'));
    });

    test('New Year Special 2018', function() {
        clock = lolex.install(moment.tz('2017-12-31 23:00:00', 'Europe/Berlin').toDate());
        let backend = new MockBackend();
        let bot = new Bot({config:config, texts:texts, backend:backend, cron:cron, debug:()=>{}});
        bot.start();

        clock.tick('02:01:00');

        assert.equal(backend._receivedMessages['sweetie'].length, 1);
        assert.notInclude(texts.sweet.morning, backend._lastReceived('sweetie'));
        assert.notInclude(texts.sweet.night, backend._lastReceived('sweetie'));
        assert.isNotNull(backend._lastReceived('sweetie'));
    });

    test('Birthday Special 2017 for sunny in LA', function() {
        let _cfg = JSON.parse(JSON.stringify(config));
        _cfg.recipient_timezones = { 'sunny3964': 'la' };
        clock = lolex.install(moment.tz('2017-12-10 06:59:59', 'America/Los_Angeles').toDate());
        let backend = new MockBackend();
        let bot = new Bot({config:_cfg, texts:texts, backend:backend, cron:cron, debug:()=>{}});
        bot.start();

        clock.tick('02:01:00');

        assert.notInclude(texts.sweet.morning, backend._lastReceived('sunny3964'));
        assert.notInclude(texts.sweet.night, backend._lastReceived('sunny3964'));
        assert.isNotNull(backend._lastReceived('sunny3964'));
        assert.match(backend._lastReceived('sunny3964'), /birthday/i);
    })

    test('Birthday Special 2018 for sunny', function() {
        clock = lolex.install(moment.tz('2018-12-10 06:59:59', 'Europe/Berlin').toDate());
        let backend = new MockBackend();
        let bot = new Bot({config:config, texts:texts, backend:backend, cron:cron, debug:()=>{}});
        bot.start();

        clock.tick('02:01:00');

        assert.notInclude(texts.sweet.morning, backend._lastReceived('sunny3964'));
        assert.notInclude(texts.sweet.night, backend._lastReceived('sunny3964'));
        assert.isNotNull(backend._lastReceived('sunny3964'));
        assert.match(backend._lastReceived('sunny3964'), /birthday/i);
    })

    test('Valentine\'s Day Special 2018', function() {
        clock = lolex.install(moment.tz('2018-02-14 06:59:59', 'Europe/Berlin').toDate());
        let backend = new MockBackend();
        let bot = new Bot({config:config, texts:texts, backend:backend, cron:cron, debug:()=>{}});
        bot.start();

        clock.tick('02:01:00');

        assert.notInclude(texts.sweet.morning, backend._lastReceived('sweetie'));
        assert.notInclude(texts.sweet.night, backend._lastReceived('sweetie'));
        assert.isNotNull(backend._lastReceived('sweetie'));
        assert.match(backend._lastReceived('sweetie'), /date/i);
    })

    afterEach(function() {
        cron.cancelAll();

        if (clock) {
            clock.uninstall();
            clock = null;
        }
    });
});
