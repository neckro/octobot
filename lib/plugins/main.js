'use strict';
const _ = require('lodash');

module.exports = {
  name: 'main',
  prefix: '!'
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
    description: `Pretty self-explanatory, isn't it?`,
    response: function (evt, msg) {
      let helpcmd = msg.params[0];
      if (_.isString(helpcmd)) helpcmd = helpcmd.trim().toLowerCase();
      let response;
      const cmds = [];
      evt.bot.each_plugin(() => {
        _.forEach(this.command_map, (o, cmd) => {
          cmd = cmd.trim();
          if (cmd.toLowerCase() === helpcmd) response = o.description;
          cmds.push(cmd);
        });
      });
      if (response) {
        msg.reply(`{$helpcmd}: ${response}`);
      } else if (helpcmd) {
        msg.reply(`Help not available: ${helpcmd}`);
      } else {
        msg.reply(`Available commands: ${cmds.sort().join(' ')}`);
      }
    }
  }
};
