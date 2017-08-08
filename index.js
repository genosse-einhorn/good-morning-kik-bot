#!/usr/bin/env node
'use strict';

let util = require('util');
let schedule = require('node-schedule');
let fs = require('fs');
let KikBotClass  = require('@kikinteractive/kik');

let OurBot = require('./bot');

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

config.persist = function() {
    fs.writeFileSync(__dirname + '/config.json', JSON.stringify(config, null, 4));
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
    let bot = new OurBot({
        config: config,
        texts: texts,
        KikBot: KikBotClass,
        schedule: schedule,
        url: URL,
        port: PORT
    });

    bot.start();

    if (clock) {
        console.log('Time travel activated! now skipping one hour');
        clock.tick('01:00:00');
    }
}
