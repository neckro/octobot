#!/usr/bin/env node

const Octobot = require('./lib');
const bot = new Octobot();

(bot
  .load('logger', {
    logdir: './logs',
    logfiles: {
      'octobot.log': {
        levels: ['debug', 'irc', 'log']
      }
    }
  })
  .load('main')
  .load('irc', {
    nick: 'Octobot',
    userName: 'octobot',
    realName: 'Octobot',
    port: 6667,
    channels: ['#octotest'],
    server: 'irc.lunarnet.org'
  })
  .load('database')
  .load('dictionary')
  .start()
);
