'use strict';
const _ = require('lodash');
const daemonize = require('start-stop-daemon');

const Octocore = require('./octocore.js');
const ConsolePlugin = require('./console.js');

module.exports = class Octobot {
  constructor (opt) {
    if (_.isObject(opt)) {
      this.config(opt);
    }
    this._eventQueue = [];
  }

  // public API: load a configuration object
  config () {
    this._eventQueue.push({
      topic: 'bot:config',
      args: arguments
    });
    return this;
  }

  // public api: load a plugin
  load () {
    this._eventQueue.push({
      topic: 'bot:load',
      args: arguments
    });
    return this;
  }

  start () {
    // Command-line options not handled by `start-stop-daemon`
    const cmd = (process.argv[2] || '').toLowerCase();
    switch (cmd) {
      case 'console':
        this.startConsole();
        break;
      default:
        this.startBot();
        break;
    }
  }

  startBot () {
    daemonize({
      outFile: '',
      errFile: ''
    }, () => {
      const bot = new Octocore();
      // Send the queued commands
      this._eventQueue.forEach(evt => {
        const args = _.flatten([evt.topic, {}, evt.args]);
        bot.emit.apply(bot, args);
      });
      // Do it
      bot.emit('bot:start');
    });
  }

  startConsole () {
    const instance = new ConsolePlugin();
    instance.connect();
  }

};
