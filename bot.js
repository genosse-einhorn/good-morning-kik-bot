'use strict';

const moment = require('moment-timezone');

function todayIs(year, month, day) {
    let today = moment.tz('Europe/Berlin');

    return (today.year() == year || year == 0)
        && today.month() == month-1
        && today.date() == day;
}

function setRandomTimeout(func, max) {
    let delay = Math.floor(Math.random() * max);
    return setTimeout(func, delay);
}

module.exports = class GreetingBot {
    constructor({config, texts, backend, cron, debug}) {
        this.config = config;
        this.texts = texts;
        this.bot = backend;
        this.cron = cron;
        this.debug = debug;
    }

    saveRecipient(username) {
        if (!this.config.recipients) {
            this.config.recipients = [];
        }

        if (!this.config.recipient_modes) {
            this.config.recipient_modes = {};
        }

        if (!this.config.recipient_timezones) {
            this.config.recipient_timezones = {};
        }

        if (this.config.recipients.indexOf(username) == -1) {
            this.config.recipients.push(username);
            this.config.recipient_modes[username] = 'sweet';
            this.config.persist();

            // retrieve and save timezone
            this.bot.getUserProfile(username).then(profile => {
                if (profile.timezone.startsWith('America/')) {
                    this.config.recipient_timezones[username] = 'la';
                } else {
                    this.config.recipient_timezones[username] = 'de';
                }
                this.config.persist();
            });

            return true;
        } else {
            return false;
        }
    }

    removeRecipient(username) {
        this.config.recipients = this.config.recipients.filter(u => u != username);
        this.config.persist();
    }

    changeRecipientMode(user, mode) {
        if (!this.config.recipient_modes) {
            this.config.recipient_modes = {};
        }

        this.config.recipient_modes[user] = mode;
        this.config.persist();
    }

    getTextRepo(user, time) {
        let mode = 'sweet';
        if (this.config.recipient_modes && this.config.recipient_modes[user])
            mode = this.config.recipient_modes[user];

        return this.texts[mode][time];
    }

    getUserTimezone(user) {
        if (this.config.recipient_timezones && this.config.recipient_timezones[user])
            return this.config.recipient_timezones[user];

        return 'de';
    }

    getMorningTextForUser(user) {
        let greetings = this.getTextRepo(user, 'morning');
        let maxCache = greetings.length / 2;

        if (!this.config.texts_sent) this.config.texts_sent = {};
        if (!this.config.texts_sent[user]) this.config.texts_sent[user] = [];

        while (this.config.texts_sent[user].length > maxCache)
            this.config.texts_sent[user].shift();

        let available = greetings.filter(e => this.config.texts_sent[user].indexOf(e) < 0);

        let text = available[Math.floor(Math.random()*available.length)];

        this.config.texts_sent[user].push(text);
        this.config.persist();

        return text;
    }

    sendWithDelay(message, user, maxDelay) {
        let delay = Math.floor(Math.random() * maxDelay);
        this.debug(`Preparing to send '${message}' to ${user} in ${Math.floor(delay/1000/60)} min`);
        setTimeout(() => {
                this.bot.send(message, user)
                    .then(() => {
                        this.debug(`Sent '${message}' to ${user}`);
                    });
            }, delay);
    }

    sendMessage(message, user) {
        let date = new Date();
        this.bot.send(message, user)
        .then(() => {
            this.debug(`Sent '${message}' to ${user} at ${date}`);
        });
    }

    getEveningTextForUser(user) {
        let nighttexts = this.getTextRepo(user, 'night');
        let maxCache = nighttexts.length / 2;

        if (!this.config.night_texts_sent) this.config.night_texts_sent = {};
        if (!this.config.night_texts_sent[user]) this.config.night_texts_sent[user] = [];

        while (this.config.night_texts_sent[user].length > maxCache)
            this.config.night_texts_sent[user].shift();

        let available = nighttexts.filter(e => this.config.night_texts_sent[user].indexOf(e) < 0);

        let text = available[Math.floor(Math.random()*available.length)];

        this.config.night_texts_sent[user].push(text);
        this.config.persist();

        return text;
    }

    sendMorningText(user) {
        if (todayIs(0, 2, 14)) {
            this.sendMessage(
                'Hey Sunshine!\n' +
                'Some days, I hate being a robot. Why? because robots cannot have meaningful relationships with humans :(\n' +
                'If I wasn\'t a robot, I\'d totally ask you out for a date today.\n' +
                'Not sure why I am telling you this... But consider yourself loved, even if it\'s just by a robot <3 🤖\n'
            , user);
        } else if (user == "sunny3964" && todayIs(0, 12, 10)) {
            // TODO: Insert sweet birthday text
            this.sendMessage("Happy Birthday!", user);
        } else {
            // business as usual
            this.sendMessage(this.getMorningTextForUser(user), user);
        }
    }

    sendEveningText(user) {
        this.sendMessage(this.getEveningTextForUser(user), user);
    }

    start() {
        this.bot.onStartChattingMessage((message) => {
            this.bot.getUserProfile(message.from)
                .then((user) => {
                    this.debug(`${message.from} started chatting!`);
                    message.reply(`Hey ${user.firstName}! Do you want to receive a `+
                        `good morning message every day? Then reply "Yes I do"`
                    );
                });
        });

        this.bot.onTextMessage((message) => {
            if (this.saveRecipient(message.from)) {
                message.reply(['Congratulations! You will now receive good morning texts!',
                        "Here's a first text to make you excited for the next morning: ",
                        this.getMorningTextForUser(message.from)])
                    .then(() => {
                        this.debug(`Registered user ${message.from}`);
                    });
            } else if (message.body.match(/thank/i) || message.body.match(/^thx/i)) {
                this.bot.send("You're welcome!", message.from)
                    .then(() => {
                        this.debug(`${message.from} thanked us: ${message.body}`);
                    });
            } else if (message.body.match(/evening/i) || message.body.match(/night/i)) {
                let text = this.getEveningTextForUser(message.from);
                this.bot.send(["Can't wait for the sunset? Here's a text for you:", text], message.from)
                .then(() => {
                    this.debug(`${message.from} couldn't wait: ${message.body}`);
                    this.debug(`we sent them '${text}'`);
                });
            } else if (message.body.match(/^be naughty to me$/i)) {
                this.changeRecipientMode(message.from, 'insult');
                this.bot.send('ok, you wanted it that way', message.from)
                .then(() => {
                    this.debug(`${message.from} got put on the naughty list.`);
                });
            } else if (message.body.match(/^be nice to me$/i)) {
                this.changeRecipientMode(message.from, 'sweet');
                this.bot.send('oh no problem sweetie :)', message.from)
                .then(() => {
                    this.debug(`${message.from} is back on the nice list`);
                });
            } else if (message.body.match(/^leave me (the fuck )?alone$/i)) {
                this.removeRecipient(message.from);
                this.bot.send(['I\'m truly devastated to see you leave :(',
                        'You can text me anytime to resume our relationship'], message.from)
                .then(() => {
                    this.debug(`${message.from} has left us :(`);
                });
            } else if (message.body.match(/^what is my timezone\??$/i)) {
                this.bot.getUserProfile(message.from)
                .then(profile => {
                    return this.bot.send('Your timezone is: ' + profile.timezone, message.from)
                });
            } else {
                let text = this.getMorningTextForUser(message.from);
                this.bot.send(["Can't wait until morning? Here's a text for you:", text], message.from)
                    .then(() => {
                        this.debug(`${message.from} couldn't wait: ${message.body}`);
                        this.debug(`we sent them '${text}'`);
                    });
            }
        });

        // Morning in Europe
        this.cron({ on: '0 7 * * *', timezone: 'Europe/Berlin' }, () => {
            this.debug('Starting morning greetings in Europe at ' + (new Date()));
            for (let user of this.config.recipients) {
                if (this.getUserTimezone(user) != 'de')
                    continue;

                this.debug('Preparing morning greetings for ' + user);
                setRandomTimeout(() => this.sendMorningText(user), 3600*1000 /* 1h */);
            }
        });

        // Morning in L.A.
        this.cron({ on: '0 7 * * *', timezone: 'America/Los_Angeles' }, () => {
            this.debug('Starting morning greetings in LA at ' + (new Date()));
            for (let user of this.config.recipients) {
                if (this.getUserTimezone(user) != 'la')
                    continue;

                this.debug('Preparing morning greetings for ' + user);
                setRandomTimeout(() => this.sendMorningText(user), 3600*1000 /* 1h */);
            }
        });

        // Evening Texts
        this.cron({ on: '0 20 * * *', timezone: 'Europe/Berlin' }, () => {
            this.debug('Starting evening greetings in Europe at ' + (new Date()));
            for (let user of this.config.recipients) {
                if (this.getUserTimezone(user) != 'de')
                    continue;

                this.debug('Preparing evening greetings for ' + user);
                setRandomTimeout(() => this.sendEveningText(user), 3600*2000 /* 2h */);
            }
        });

        this.cron({ on: '0 20 * * *', timezone: 'America/Los_Angeles' }, () => {
            this.debug('Starting evening greetings in LA at ' + (new Date()));
            for (let user of this.config.recipients) {
                if (this.getUserTimezone(user) != 'la')
                    continue;

                this.debug('Preparing evening greetings for ' + user);
                setRandomTimeout(() => this.sendEveningText(user), 3600*2000 /* 2h */);
            }
        });

        // Christmas Special
        this.cron({ on: '0 18 24 12 *', timezone: 'Europe/Berlin' }, () => {
            for (let user of this.config.recipients) {
                this.sendWithDelay("Merry Christmas, Beautiful!", user, 30*60*1000 /* 30min */)
            }
        });

        // Ney Year Special
        this.cron({ on: '5 0 1 1 *', timezone: 'Europe/Berlin' }, () => {
            for (let user of this.config.recipients) {
                this.sendWithDelay("Happy New Year, My Angel <3", user, 5*60*1000 /* 5 min */);
            }
        });

        this.debug(`${this.config.username} has started, registed users: ${(this.config.recipients || []).join(', ')}`);
    }

}
