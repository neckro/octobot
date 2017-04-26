'use strict';
const _ = require('lodash');

module.exports = {
  name: 'main',
  defaults: {
    prefix: '!'
  }
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
      if (!_.isString(helpcmd)) helpcmd = '';
      helpcmd = helpcmd.trim().toLowerCase();
      let response;
      const commandList = [];
      evt.bot.each_plugin(plugin => {
        _.forEach(plugin.commands, cmd => {
          const trigger = cmd.trigger.trim();
          if (trigger.toLowerCase() === helpcmd) {
            response = cmd.description;
          }
          commandList.push(trigger);
        });
      });
      if (response) {
        msg.reply(`${helpcmd}: ${response}`);
      } else if (helpcmd) {
        msg.reply(`Help not available: ${helpcmd}`);
      } else {
        msg.reply(`Available commands: ${commandList.sort().join(' ')}`);
      }
    }
  }
};
