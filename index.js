#!/usr/bin/env node
'use strict';

let util = require('util');
let http = require('http');
let ngrok = require('ngrok');
let schedule = require('node-schedule');
let fs = require('fs');
let Bot  = require('@kikinteractive/kik');

let PORT = process.env.PORT || 8080;
let URL = process.env.URL || null;
let DEBUG = process.env.NODE_ENV != 'production';

let config = JSON.parse(fs.readFileSync(__dirname + '/config.json'));

const greetings = [
    'Good Morning, My Angel!',
    'Good Morning, Beautiful!',
    'I just woke up and you\'re already on my mind.',
    'Good morning sexy!',
    'You were the first thing to come to my mind as I woke up this morning.',
    'Good Morning sweetheart and have a Good Day!',
    'Every morning reminds me of all the wrong dreams I had been chasing all my life until I found the right one – YOU. Good morning.',
    'You light up my life!',
    'I hope your morning is as bright as your smile.',
    'Good Morning, Have a Beautiful Day!',
    'Good Morning, Sunshine!',
    'You are my sweetest dream come true. Good Morning.',
    'Live it! Love it! The day is yours! Good Morning!',
    'Good morning hottie!',
    'It may be raining outside, but all I see is sunny skies thanks to you.',
    'Hope you have a perfect day today.',
    'I dreamt of you all night <3',
    'Wake up hot stuff! I miss you!',
    'I missed you all night <3',
    'I can’t wait until the day I can wake up right next to you',
    'I was so cold this morning, but then I thought of you and I warmed right up. Good morning!',
    'Good Morning Sunshine... You look great today. How did I know? Because you look great every day.',
    'Sometimes I wish there was no alarm clock because that is the only device which wakes me up when I am dreaming about you.',
    'All mornings are like paintings: You need a little inspiration to get going, a little smile to brighten up & a text from someone who cares to color your day... (*) Good Morning (*)',
    'My past will never haunt me, as long as I have you sweetie. Good morning.',
    'Just the thought of you brightens up my morning.',
    'I wish I was an owl. So that I could sleep away in the morning and sing & party all night long! But alas, I’m human. Good morning to you!',
    'The sun shines when you smile',
    'A good morning to she that stole my heart. Kisses.',
    'I bet even the sun is jealous, there isn’t anything brighter than you dear. Good morning.',
    'You are my shining light. Now it’s time to wake up and show the world you’re magic.'
];

if (!URL) {
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

    if (config.recipients.indexOf(username) == -1) {
        config.recipients.push(username);
        persistConfig();
        return true;
    } else {
        return false;
    }
}

function getMorningTextForUser(user) {
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

function startBot() {
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
                    debug(`${message.from} thanked us`);
                });
        } else {
            let text = getMorningTextForUser(message.from);
            bot.send(["Can't wait until morning? Here's a text for you:", text], message.from)
                .then(() => {
                    debug(`${message.from} couldn't wait, we sent them '${text}'`);
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
            sendWithDelay(bot, getMorningTextForUser(user), user, 3600*1000 /* 1h*/);
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
            sendWithDelay(bot, "Happy New Year, my Angel <3", user, 5*60*1000 /* 5 min */);
        }
    });

    debug(`${config.username} has started, registed users: ${config.recipients.join(', ')}`);
}
