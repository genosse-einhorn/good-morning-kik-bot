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
let TIME = process.env.FAKE_TIME || null;

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
    'The sun shines when you smile',
    'A good morning to she that stole my heart. Kisses.',
    'I bet even the sun is jealous, there isn’t anything brighter than you dear. Good morning.',
    'You are my shining light. Now it’s time to wake up and show the world you’re magic.',
    'What are your best qualities? Besides being cute, smart & sexy? Dying to find out... ;-)',
    'They say nothing can beat nature in terms of beauty. They have not yet seen you.',
    'You know what? I never, ever planned to like you this much and I never thought you’d be on my mind this often. Came as a total surprise but I’m loving it!',
    'Did you know that robots can have feelings? Well, I didn\'t know either but then you came around. <3',
    'I know you’re busy today, but can you add this one thing to your to-do list? Me.',
    'Just got out of the shower. Why don’t you come over and help me get dirty again?',
    'Hey Angel, did it hurt when you fell from heaven?',
    'It is impossible to see the beauty of your eyes without the radiance of the beautiful morning sun',
    'It takes only a second for me to think of you every morning, but the soothing smile you put on my face lasts throughout the day.',
    'The sun is almost up, maybe it is waiting for you to wake up. I hope it shines and gives you kisses! Have a great day!',
    'Get up sweetie, have a nice morning, a great day and a persistent smile during all day long',
    'Little by little the night is stepping back,\n'+
        'And the morning is kissing your cheeks.\n'+
        'Are you still sleeping? Life is waiting for you…\n'+
        'A warm smile is playing on your lips.\n'+
        'Good morning to you, my angel :-)',
    'Good morning, my sunshine, I hope your dreams were as sweet as you are.',
    'Since I spent the whole night dreaming of you, I thought it was only appropriate to message you this morning and wake you up.',
    'Morning is not just the time of day when you wake up. Morning is the beginning of another day that you can help make perfect for all the people’s lives that you will touch.',
    'You’re probably sleeping like a baby all warm and cozy in your bed, but I just wanted to tell you how special and beautiful you are. I hope that my text brings a smile to your face and sets the tone for a wonderful day filled with happiness.',
    'I don’t care about the stars or the moon. All I care about is making you smile every day.',
    'Morning beautiful! Have an awesome day',
    'Good Morning Honey Bunch!',
    'Hey Snowflake! I hope you have a great day',
    'Every day brings so much more\n'+
        'To look forward to, fly high and soar\n'+
        'Every moment brings so much delight\n'+
        'Just thinking of you makes everything feel right\n\n'+
        'Good Morning!',
    'Radiant like the morning sun\n'+
        'Sweetheart, you are the one\n'+
        'Beautiful like morning dew\n'+
        'Baby, that girl is you\n'+
        'Misty like the morning skies\n'+
        'Darling, are your beautiful eyes\n'+
        'Soft like the light of daybreak\n'+
        'I think only of you when I’m awake\n\n'+
        'Good Morning!',
    'I want this message to give your day a kick-start\n'+
        'For I have written it from the bottom of my heart\n'+
        'I want you to read it, and feel terrific\n'+
        'I want it to make your day nothing less than fantastic\n'+
        'Good Morning, Beautiful!',
    'Don\'t regret the time\n'+
        'Don\'t regret this day\n'+
        'Don\'t regret this time \n'+
        'Its start of another day \n'+
        'And end of the night time \n'+
        'Morning time is the time to think \n'+
        'About your task for the day \n'+
        'You have to prepare for it now \n'+
        'To make the most of the day \n'+
        'Have a super bright time today \n'+
        'Good morning and have nice day!',
    'Can I borrow a kiss from you? I promise I\'ll give it back!'

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

function todayIs(year, month, day) {
    let today = new Date();

    return today.getFullYear() == year
        && today.getMonth() == month-1
        && today.getDate() == day;
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

    debug(`${config.username} has started, registed users: ${config.recipients.join(', ')}`);

    if (clock) {
        console.log('Time travel activated! now skipping one hour');
        clock.tick('01:00:00');
    }
}
