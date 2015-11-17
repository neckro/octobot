"use strict";

var _ = require('lodash');
var moment = require('moment');
var format = require('util').format;
var path = require('path');
var fs = require('fs');

module.exports = {
  defaults: {
    exclude_events: {
      log: true,
      irc: true
    }
  },

  init: function() {
    var self = this;

    this.logMap = this.generateLogMap(_.get(this.config, 'logfiles'));

    this.onAny(function(evt) {
      var eventName = this.event;
      var prefix = eventName.split(':')[0];
      if (self.config.exclude_events[eventName.split(':')[0]]) return;

      self.log('debug', format('[%s]', evt.origin), [
        eventName,
        format('(%s)', _.map(_.slice(arguments, 1), function(arg) {
          return _.dropRight(
            // omg so hacky
            Object.prototype.toString.call(arg).toLowerCase().split(' ')[1]
          ).join('');
        }).join(', '))
      ]);
    });

    // TODO: properly use async_wrap for this stuff
    // until then, fuck the police
    process.on('uncaughtException', function(err) {
      this.log('error', '[logger]', err);
    }.bind(this));
    process.on('unhandledRejection', function(err) {
      this.log('error', '[logger]', err);
    }.bind(this));
  },

  listeners: {
    'log:*': function(evt) {
      var args = _.slice(arguments, 1);
      var level = evt.event.split(':')[1];
      this.log(level, format('[%s]', evt.origin), args);
      evt.resolve();
    },
    'irc:raw': function(evt, message) {
      // 37x = MOTDs; skip them
      if (message.rawCommand.match(/(PRIVMSG)|(PING)|(37\d)/)) return;
      this.log('irc', 'IRC|', [
        message.rawCommand,
        message.args.slice(1).join(' ')
      ]);
    },
    'irc:message': function(evt, msg) {
      this.log('irc', 'IRC>', [
        msg.to,
        format('<%s>', msg.from),
        msg.text
      ]);
    },
    // This event is undocumented in node-irc
    'irc:selfMessage': function(evt, to, text) {
      this.log('irc', 'IRC:', [
        '[' + to + ']',
        text
      ]);
    },
    'irc:pm': function(evt, nick, text, message) {
      this.log('irc', 'IRC!', [
        '<' + nick + '>',
        text
      ]);
    }
  },

  destroy: function() {
    var streams = _.uniq(_.flatten(_.map(this.logMap, function(mapping, level) {
      return _.pluck(mapping, 'stream');
    })));
    _.each(streams, function(stream) {
      stream.end();
    });
  },

  generateLogMap: function(config) {
    config = _.cloneDeep(config);
    var logMap = {};
    var log = this.log.bind(this);
    _.each(config, function(logCfg, logName) {
      var targetPath = path.resolve(_.get(this.config, 'logdir'), logName);
      var stream = fs.createWriteStream(targetPath);
      var logTarget = _.extend(logCfg, {
        name: logName,
        path: targetPath,
        stream: stream
      });
      stream.on('error', function(err) {
        // If we can't open the log file, log it...
        this.log('error', '[logger]', err);
        // ...then invalidate the stream ref
        logTarget.stream = false;
      }.bind(this));
      _.each(_.get(logCfg, 'levels', []), function(level) {
        if (!_.isArray(logMap[level])) logMap[level] = [];
        logMap[level].push(logTarget);
      });
    }, this);
    return logMap;
  },

  log: function(level, prefix, in_data) {
    var log_line = [
      moment().format('YYYY-MM-DD HH:mm:ss'),
      level,
      prefix
    ].concat(in_data).join(' ');
    console.log(log_line);
    _.each(this.logMap[level], function(logTarget) {
      if (logTarget.stream) {
        logTarget.stream.write(log_line + '\n', 'utf8');
      }
    });
  }

};
