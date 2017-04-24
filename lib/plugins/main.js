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
      const pluginName = opt.params[0];
      if (_.isString(pluginName) && opt.bot.load_plugin(pluginName)) {
        opt.reply(`Successfully reloaded module: ${pluginName}`);
      } else {
        opt.reply(`Couldn't reload module: ${pluginName}`);
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
