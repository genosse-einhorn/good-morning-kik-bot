#!/usr/bin/env node
'use strict';

let util = require('util');
let http = require('http');
let schedule = require('node-schedule');
let fs = require('fs');
let Bot  = require('@kikinteractive/kik');

let PORT = process.env.PORT || 8080;
let URL = process.env.URL || null;
let DEBUG = process.env.NODE_ENV != 'production';
let TIME = process.env.FAKE_TIME || null;

let config = require(__dirname + '/config.json');
let texts = {
    'sweet': require(__dirname + '/greetings-sweet.json'),
    'insult': require(__dirname + '/greetings-insult.json')
};

// fixup texts
for (let mode in texts) {
    if (!texts[mode]['night'])
        texts[mode]['night'] = texts[mode]['morning'];
}

if (!URL) {
    let ngrok = require('ngrok');

    // Auto-ngrok for local debugging
    ngrok.connect(PORT, (err, url) => {
        if (err) throw err;

        URL = url;
        startBot();
    });
} else {
    startBot();
}

process.on('unhandledRejection', (reason, promise) => {
    console.error('unhadled rejection!:');
    console.error(reason);
    process.exit(1);
})

function debug(msg) {
    if (DEBUG) {
        console.log(msg);
    }
}

function persistConfig() {
    fs.writeFileSync(__dirname + '/config.json', JSON.stringify(config, null, 4));
}

function saveUser(username) {
    if (!config.recipients) {
        config.recipients = [];
    }

    if (!config.recipient_modes) {
        config.recipient_modes = {};
    }

    if (config.recipients.indexOf(username) == -1) {
        config.recipients.push(username);
        config.recipient_modes[username] = 'sweet';
        persistConfig();
        return true;
    } else {
        return false;
    }
}

function changeRecipientMode(user, mode) {
    if (!config.recipient_modes) {
        config.recipient_modes = {};
    }

    config.recipient_modes[user] = mode;
    persistConfig();
}

function getTextRepo(user, time) {
    let mode = 'sweet';
    if (config.recipient_modes && config.recipient_modes[user])
        mode = config.recipient_modes[user];

    return texts[mode][time];
}

function getMorningTextForUser(user) {
    let greetings = getTextRepo(user, 'morning');
    let maxCache = greetings.length / 2;

    if (!config.textsSent) config.textsSent = {};
    if (!config.textsSent[user]) config.textsSent[user] = [];

    while (config.textsSent[user].length > maxCache)
        config.textsSent[user].shift();

    let available = greetings.filter(e => config.textsSent[user].indexOf(e) < 0);

    let text = available[Math.floor(Math.random()*available.length)];

    config.textsSent[user].push(text);
    persistConfig();

    return text;
}

function sendWithDelay(bot, message, user, maxDelay) {
    let delay = Math.floor(Math.random() * maxDelay);
    debug(`Preparing to send '${message}' to ${user} in ${Math.floor(delay/1000/60)} min`);
    setTimeout(() => {
            bot.send(message, user)
                .then(() => {
                    debug(`Sent '${message}' to ${user}`);
                });
        }, delay);
}

function todayIs(year, month, day) {
    let today = new Date();

    return today.getFullYear() == year
        && today.getMonth() == month-1
        && today.getDate() == day;
}

function getEveningTextForUser(user) {
    let nighttexts = getTextRepo(user, 'night');
    let maxCache = nighttexts.length / 2;

    if (!config.nightTextsSent) config.nightTextsSent = {};
    if (!config.nightTextsSent[user]) config.nightTextsSent[user] = [];

    while (config.nightTextsSent[user].length > maxCache)
        config.nightTextsSent[user].shift();

    let available = nighttexts.filter(e => config.nightTextsSent[user].indexOf(e) < 0);

    let text = available[Math.floor(Math.random()*available.length)];

    config.nightTextsSent[user].push(text);
    persistConfig();

    return text;
}


function startBot() {
    let clock = null;
    // fake time
    if (TIME) {
        try {
            let lolex = require('lolex');
            clock = lolex.install(Date.parse(TIME));
            console.log('Time travel activated! Today is ' + new Date());
        } catch (e) {
            console.log('Fake time could not be initialized: ' + e);
        }
    }

    // Configure the bot API endpoint, details for your bot
    let bot = new Bot({
        username: config.username,
        apiKey: config.key,
        baseUrl: URL
    });

    bot.updateBotConfiguration();

    bot.onTextMessage((message) => {
        if (saveUser(message.from)) {
            message.reply(['Congratulations! You will now receive good morning texts!',
                    "Here's a first text to make you excited for the next morning: ",
                    getMorningTextForUser(message.from)])
                .then(() => {
                    debug(`Registered user ${message.from}`);
                });
        } else if (message.body.match(/thank/i) || message.body.match(/^thx/i)) {
            bot.send("You're welcome!", message.from)
                .then(() => {
                    debug(`${message.from} thanked us: ${message.body}`);
                });
        } else if (message.body.match(/evening/i) || message.body.match(/night/i)) {
            let text = getEveningTextForUser(message.from);
            bot.send(["Can't wait for the sunset? Here's a text for you:", text], message.from)
            .then(() => {
                debug(`${message.from} couldn't wait: ${message.body}`);
                debug(`we sent them '${text}'`);
            });
        } else if (message.body.match(/^be naughty to me$/i)) {
            changeRecipientMode(message.from, 'insult');
            bot.send('ok, you wanted it that way', message.from)
            .then(() => {
                debug(`${message.from} got put on the naughty list.`);
            });
        } else if (message.body.match(/^be nice to me$/i)) {
            changeRecipientMode(message.from, 'sweet');
            bot.send('oh no problem sweetie :)', message.from)
            .then(() => {
                debug(`${message.from} is back on the nice list`);
            });
        } else {
            let text = getMorningTextForUser(message.from);
            bot.send(["Can't wait until morning? Here's a text for you:", text], message.from)
                .then(() => {
                    debug(`${message.from} couldn't wait: ${message.body}`);
                    debug(`we sent them '${text}'`);
                });
        }
    });

    bot.onStartChattingMessage((message) => {
        bot.getUserProfile(message.from)
            .then((user) => {
                debug(`${message.from} started chatting!`);
                message.reply(`Hey ${user.firstName}! Do you want to receive a `+
                    `good morning message every day? Then reply "Yes I do"`
                );
            });
    });

    // Set up your server and start listening
    let server = http
        .createServer(bot.incoming())
        .listen(PORT);

    schedule.scheduleJob('0 7 * * *', () => {
        for (let user of config.recipients) {
            if (user == "sunny3964" && todayIs(2016, 12, 23)) {
                // exam special
                sendWithDelay(bot, [
                    getMorningTextForUser(user),
                    "I was told that today is your last exam for this year. " +
                    "Good luck! I know you can do it."
                ], user, 3600*1000 /* 1h */);
            } else if (todayIs(2017, 2, 14)) {
                // TODO: Make year independent
                sendWithDelay(bot,
                    'Hey Sunshine!\n' +
                    'Some days, I hate being a robot. Why? because robots can not have meaningful relationships with humans :(\n' +
                    'If I weren\'t a robot, I\'d totally ask you out for a date today.\n' +
                    'Not sure why I am telling you this... But consider yourself loved, even if it\'s just by a robot <3 🤖\n'
                , user, 3600*1000 /* 1h */);
            } else if (user == "sunny3964" && todayIs(2017, 12, 10)) {
                // TODO: Make year independent
                // TODO: Insert sweet birthday text
                sendWithDelay(bot, "Happy Birthday!", user, 3600*1000 /* 1h */);
            } else {
                // business as usual
                sendWithDelay(bot, getMorningTextForUser(user), user, 3600*1000 /* 1h */);
            }
        }
    });

    // Evening Texts
    schedule.scheduleJob('0 20 * * *', () => {
        for (let user of config.recipients) {
            sendWithDelay(bot, getEveningTextForUser(user), user, 3600*2000 /* 2h */);
        }
    });

    // Christmas Special
    schedule.scheduleJob('0 18 24 12 *', () => {
        for (let user of config.recipients) {
            sendWithDelay(bot, "Merry Christmas, Beautiful!", user, 30*60*1000 /* 30min */);
        }
    });

    // Ney Year Special
    schedule.scheduleJob('5 0 1 1 *', () => {
        for (let user of config.recipients) {
            sendWithDelay(bot, "Happy New Year, My Angel <3", user, 5*60*1000 /* 5 min */);
        }
    });

    debug(`${config.username} has started, registed users: ${(config.recipients || []).join(', ')}`);

    if (clock) {
        console.log('Time travel activated! now skipping one hour');
        clock.tick('01:00:00');
    }
}
