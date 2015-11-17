"use strict";
var fs = require('fs');
var path = require('path');
var util = require('util');

var _ = require('lodash');
var Promise = require('bluebird');
var EventEmitter = require('eventemitter2').EventEmitter2;

var Plugin = require('./plugin');

var Bot = module.exports = function() {
  EventEmitter.call(this, {
    wildcard: true,
    delimiter: ':',
    maxListeners: 50
  });

  this.config = {};
  this.plugins = {};

  // Add bot event listeners
  _.each(bot_listeners, function(listener, event) {
    this.on(event, _.bind(listener, this));
  }, this);

  this.emit('bot:ready');
};

util.inherits(Bot, EventEmitter);

_.extend(Bot.prototype, {
  load_plugin: function load_plugin(pluginName, options) {
    // TODO: Unload the previous plugin if name is duplicate
    return (
      Plugin.load_plugin(pluginName, options)
      .bind(this)
      .then(function(instance) {
        this.plugins[pluginName] = instance;
        instance.on('plugin:dispatch', this.dispatch.bind(this));
        return instance.emitP('start');
      })
    );
  },

  dispatch: function(evt) {
    evt.bot = this;
    _.forEach(this.plugins, function(instance) {
      instance.emit.apply(instance, evt.args);
    });
  },

  // Iterate all plugins with a callback
  each_plugin: function(callback) {
    var args = Array.prototype.slice.call(arguments, 1);
    _.forEach(this.plugins, function(p) {
      callback.apply(p, args);
    });
  }
});

var bot_listeners = {
  'bot:config': function(evt, config) {
    _.extend(this.config, config);
  },
  'bot:start': function(evt) {
    return;
  },
  'bot:load': function(evt, pluginName, options) {
    var out = this.load_plugin(pluginName, options);
    var resolve = _.get(evt, 'resolve');
    if (_.isFunction(resolve)) resolve(out);
  }
};
