'use strict';
const _ = require('lodash');
const moment = require('moment');
const path = require('path');
const fs = require('fs');

module.exports = {
  name: 'logger',
  defaults: {
    exclude_events: {
      log: true,
      irc: true
    }
  },

  init: function () {
    const self = this;

    this.logMap = this.generateLogMap(_.get(this.config, 'logfiles'));

    this.onAny(function (evt, ...args) {
      const eventName = this.event;
      const prefix = eventName.split(':')[0];
      if (self.config.exclude_events[prefix]) return;

      // omg so hacky... show the types of the event arguments in the log
      const arglist = _.map(args, arg => {
        return _.dropRight(
          Object.prototype.toString.call(arg).toLowerCase().split(' ')[1]
        ).join('');
      }).join(', ');
      self.log('debug', `[${evt.origin}] ${eventName} (${arglist})`);
    });

    // TODO: properly use async_wrap for this stuff
    // until then, fuck the police
    const logHandler = err => {
      const errText = err.stack.replace(/ *\n */g, ' ');
      this.log('error', '[logger]', `Unhandled ${errText}`);
    };
    process.on('uncaughtException', logHandler);
    process.on('unhandledRejection', logHandler);
  },

  listeners: {
    'log:*': function (evt, ...args) {
      const level = evt.event.split(':')[1];
      this.log(level, `[${evt.origin}]`, args);
      evt.resolve();
    },
    'irc:raw': function (evt, message) {
      // 37x = MOTDs; skip them
      if (message.rawCommand.match(/(PRIVMSG)|(PING)|(37\d)/)) return;
      this.log('irc', '|', [
        message.rawCommand,
        message.args.slice(1).join(' ')
      ]);
    },
    'irc:message': function (evt, msg) {
      this.log('irc', `> ${msg.to} <{$msg.from}> ${msg.text}`);
    },
    // This event is undocumented in node-irc
    // (own sent)
    'irc:selfMessage': function (evt, to, text) {
      this.log('irc', `: [${to}] ${text}`);
    },
    'irc:pm': function (evt, nick, text) {
      this.log('irc', `! <${nick}> ${text}`);
    }
  },

  destroy: function () {
    _(this.logMap)
      .map(mapping => _.pluck(mapping, 'stream'))
      .flatten()
      .uniq()
      .map(stream => stream.end());
  },

  generateLogMap: function (config) {
    const logMap = {};
    _.each(config, (logCfg, logName) => {
      const targetPath = path.resolve(_.get(this.config, 'logdir'), logName);
      const stream = fs.createWriteStream(targetPath);
      const logTarget = _.extend({}, logCfg, {
        name: logName,
        path: targetPath,
        stream: stream
      });
      stream.on('error', err => {
        // If we can't open the log file, log it...
        this.log('error', '[logger]', err);
        // ...then invalidate the stream ref
        logTarget.stream = false;
      });
      _.each(_.get(logCfg, 'levels', []), level => {
        if (!_.isArray(logMap[level])) logMap[level] = [];
        logMap[level].push(logTarget);
      });
    });
    return logMap;
  },

  log: function (level, prefix, in_data) {
    const log_line = [
      moment().format('YYYY-MM-DD HH:mm:ss'),
      level,
      prefix
    ].concat(in_data).join(' ');
    console.log(log_line);  // eslint-disable-line no-console

    _.each(this.logMap[level], logTarget => {
      if (logTarget.stream) {
        logTarget.stream.write(log_line + '\n', 'utf8');
      }
    });
  }

};
