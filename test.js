const assert = require('chai').assert;
const EventEmitter = require('events').EventEmitter;
const schedule = require('node-schedule');

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

suite('Welcome Message', function() {
    test('receiving welcome message', function() {
        let config = {};
        let texts = {};
        let backend = new MockBackend();
        let bot = new Bot({config:config, texts:texts, backend:backend, schedule:schedule, debug:()=>{}});

        backend._fakeStartChatting('blub');
        assert.isTrue(backend._lastReceived('blub'));
    });
});
