'use strict';
const _ = require('lodash');
const EventEmitter = require('eventemitter2').EventEmitter2;

const Plugin = require('./plugin');

module.exports = class Octobot extends EventEmitter {
  constructor () {
    super({
      wildcard: true,
      delimiter: ':',
      maxListeners: 50
    });

    this.config = {};
    this.plugins = {};

    // Add bot event listeners
    _.each(bot_listeners, function (listener, event) {
      this.on(event, _.bind(listener, this));
    }, this);

    this.emit('bot:ready');
  }

  load_plugin (pluginName, options) {
    // TODO: Unload the previous plugin if name is duplicate
    return (
      Plugin.load_plugin(pluginName, options)
        .bind(this)
        .then(function (instance) {
          this.plugins[pluginName] = instance;
          instance.on('plugin:dispatch', this.dispatch.bind(this));
          return instance.emitP('start');
        })
    );
  }

  dispatch (evt) {
    evt.bot = this;
    _.forEach(this.plugins, instance => instance.emit(...evt.args));
  }

  // Iterate all plugins with a callback
  each_plugin (callback) {
    _.forEach(this.plugins, plugin => callback(plugin));
  }

};

const bot_listeners = {
  'bot:config': function (evt, config) {
    _.extend(this.config, config);
  },
  'bot:start': function (evt) {
    return;
  },
  'bot:load': function (evt, pluginName, options) {
    const out = this.load_plugin(pluginName, options);
    const resolve = _.get(evt, 'resolve');
    if (_.isFunction(resolve)) resolve(out);
  }
};
