"use strict";
var _ = require('lodash');

module.exports = {
  name: 'main',
  prefix: '!',
};

module.exports.commands = {
/*
  'reload': {
    description: "Reload a plugin module.",
    response: function(evt, msg) {
      if (_.isString(opt.params[0]) && opt.bot.load_plugin(opt.params[0])) {
        opt.reply("Successfully reloaded module: %s", opt.params[0]);
      } else {
        opt.reply("Couldn't reload module: %s", opt.params[0]);
      }
    }
  },
*/
  'help': {
    description: "Pretty self-explanatory, isn't it?",
    response: function(evt, msg) {
      var helpcmd = msg.params[0];
      if (_.isString(helpcmd)) helpcmd = helpcmd.trim().toLowerCase();
      var response;
      var cmds = [];
      evt.bot.each_plugin(function() {
        _.forEach(this.command_map, function(o, cmd) {
          cmd = cmd.trim();
          if (cmd.toLowerCase() === helpcmd) response = o.description;
          cmds.push(cmd);
        });
      });
      if (response) {
        msg.reply('%s: %s', helpcmd, response);
      } else if (helpcmd) {
        msg.reply('Help not available: %s', helpcmd);
      } else {
        msg.reply('Available commands: %s', cmds.sort().join(' '));
      }
    }
  }
};
