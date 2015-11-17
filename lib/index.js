"use strict";
var _ = require('lodash');
var daemonize = require('start-stop-daemon');

var Octocore = require('./octocore.js');
var ConsolePlugin = require('./console.js');

var Octobot = module.exports = function Octobot(opt) {
  if (!(this instanceof Octobot)) {
    return new Octobot(opt);
  }
  if (_.isObject(opt)) {
    this.config(opt);
  }
  this._eventQueue = [];
};

// These commands are queued, since the bot might not actually start
_.each(['config', 'load'], function(cmd) {
  Octobot.prototype[cmd] = function queuedCommand() {
    this._eventQueue.push(_.flatten(['bot:' + cmd, {}, arguments]));
    return this;
  };
});

_.extend(Octobot.prototype, {

  start: function start() {
    // Command-line options not handled by `start-stop-daemon`
    var cmd = (process.argv[2] || '').toLowerCase();
    switch (cmd) {
      case 'console':
        this.startConsole();
        break;
      default:
        this.startBot();
        break;
    }
  },

  startBot: function startBot() {
    daemonize({
      outFile: '',
      errFile: ''
    }, function() {
      var bot = new Octocore();
      // Send the queued commands
      this._eventQueue.forEach(function(evt) {
        bot.emit.apply(bot, evt);
      });
      // Do it
      bot.emit('bot:start');
    }.bind(this));
  },

  startConsole: function startConsole() {
    var instance = new ConsolePlugin();
    instance.connect();
  }

});
