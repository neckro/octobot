'use strict';
const _ = require('lodash');
const irc = require('irc');

const irc_defaults = {
  autoConnect: false,
  userName: 'octobot',
  realName: 'Octobot'
};

const colors = {
  white: 0,
  black: 1,
  blue: 2,
  dark_blue: 2,
  dark_green: 3,
  red: 4,
  light_red: 4,
  dark_red: 5,
  magenta: 6,
  orange: 7,
  yellow: 8,
  light_green: 9,
  cyan: 10,
  light_cyan: 11,
  light_blue: 12,
  light_magenta: 13,
  gray: 14,
  light_gray: 15
};

const special_codes = {
  reset: '\u000f',
  r: '\u000f',
  bold: '\u0002',
  b: '\u0002',
  underline: '\u001f',
  u: '\u001f',
  '/': '\u0003'
};

module.exports = {
  name: 'irc',

  init: function init (config) {
    const irc_config = _.extend(
      {},
      irc_defaults,
      _.omit(config, ['server', 'nick'])
    );

    this.client = new irc.Client(
      config.server,
      config.nick,
      irc_config
    );

    // In order to capture all node-irc events,
    // we have to do this gross thing
    const emit = this.client.emit;
    this.client.emit = function (event) {
      const args = _.toArray(arguments);
      if (!_.isString(event)) return;
      emit.apply(this.client, args);
      if (_.isFunction(irc_listeners[event])) {
        irc_listeners[event].apply(this, _.slice(args, 1));
        return;
      }
      // Prefix the event name
      args[0] = 'irc:' + event;
      this.dispatch.apply(this, args);
    }.bind(this);

    this.client.connect();
  },

  // for posterity
  split_line: function (text, length) {
    let out = '', pos;
    if (!length || !_.isString(text)) return;
    while (text.length > length) {
      pos = length;
      while (pos > 0 && text.charAt(pos) !== ' ') pos--;
      if (pos === 0) pos = length;
      out += text.substr(0, pos) + '\n';
      text = text.substr(pos + 1);
    }
    out += text;
    return out;
  },

  // Parse colors in an irc:saycolor commmand
  // https://github.com/martynsmith/node-irc/blob/master/lib/colors.js
  // http://www.mirc.com/colors.html
  colorize: function (text) {
    return text.replace(/\{(([^,}]+),?([^,}]*))\}/g, (match, code, fgcolor, bgcolor) => {
      const special = special_codes[code.toLowerCase()];
      if (_.isString(special)) return special;
      let fgNum = (colors[fgcolor.toLowerCase()] || parseInt(fgcolor, 10) % 99 || 99).toString();
      let bgNum = (colors[bgcolor.toLowerCase()] || parseInt(bgcolor, 10) % 99 || '').toString();
      if (fgNum.length === 1) fgNum = '0' + fgNum;
      if (bgNum.length === 1) bgNum = '0' + bgNum;
      return '\u0003' + fgNum + (bgNum ? ',' : '') + bgNum;
    });
  },

  commands: {
  },

  listeners: {
    // irc:cmd events match the node-irc API:
    // https://node-irc.readthedocs.org/en/latest/API.html#client
    'irc:cmd:send': function (evt) {
      this.client.send.apply(this.client, _.slice(arguments, 1));
      evt.resolve();
    },
    'irc:cmd:join': function (evt, channel) {
      this.client.join(channel, evt.resolve);
    },
    'irc:cmd:part': function (evt, channel, message) {
      this.client.part(channel, message, evt.resolve);
    },
    'irc:cmd:saycolor': function (evt, target, message) {
      this.client.say(target, this.colorize(message));
      evt.resolve();
    },
    // Not colorized
    'irc:cmd:say': function (evt, target, message) {
      this.client.say(target, message);
      evt.resolve();
    },
    'irc:cmd:ctcp': function (evt, target, type, text) {
      this.client.ctcp(target, type, text);
      evt.resolve();
    },
    'irc:cmd:action': function (evt, target, message) {
      this.client.action(target, message);
      evt.resolve();
    },
    'irc:cmd:notice': function (evt, target, message) {
      this.client.notice(target, message);
      evt.resolve();
    },
    'irc:cmd:whois': function (evt, nick) {
      this.client.whois(nick, evt.resolve);
    },
    'irc:cmd:list': function (evt) {
      this.client.list.apply(this.client, _.slice(arguments, 1));
      evt.resolve();
    },
    'irc:cmd:connect': function (evt, retries) {
      this.client.connect(retries, evt.resolve);
    },
    'irc:cmd:disconnect': function (evt, message) {
      this.client.disconnect(message, evt.resolve);
    },
    'irc:cmd:activateFloodProtection': function (evt, interval) {
      this.client.activateFloodProtection(interval);
      evt.resolve();
    }
  }
};

const irc_listeners = {
  'message': function (nick, to, text, message) {
    const replyto = (to === this.client.nick) ? nick : to;
    const self = this;
    const opt = {
      to: to,
      from: nick,
      text: text.trim(),
      raw: message,
      privmsg: (to === this.client.nick),
      replyto: replyto,
      reply: function (reply) {
        const args = Array.prototype.slice.call(arguments);
        args.unshift('irc:cmd:say', replyto);
        self.emitP.apply(self, args);
      }
    };
    this.dispatch('irc:message', opt);
  },

  'error': function () {
    this.dispatch('log:error', 'IRC error', arguments);
  }
};
