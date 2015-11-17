"use strict";
var fs = require('fs');
var path = require('path');
var util = require('util');

var _ = require('lodash');
var Promise = require('bluebird');
var EventEmitter = require('eventemitter2').EventEmitter2;

var plugin_resolve_subpath = 'plugins';
var plugin_max_resolve_depth = 10;

var emitter_options = {
  wildcard: true,
  delimiter: ':',
  maxListeners: 50
};

var Plugin = module.exports = function(plugin_obj, options) {
  _.extend(this, plugin_obj);
  this.init_emitters();
  this.populate_command_map();
  this.config = _.extend({}, this.defaults, options);

  this.once('start', function() {
    var initPromise;
    if (_.isFunction(this.init)) {
      initPromise = this.init(options);
    }
    Promise.resolve(initPromise)
    .bind(this)
    .then(function() {
      this.dispatch('plugin:loaded');
    })
    .catch(function(err) {
      this.dispatch('log:error', err);
      this.dispatch('plugin:failure');
    });
  }.bind(this));
};

util.inherits(Plugin, EventEmitter);

// Static plugin methods
_.extend(Plugin, {
  load_plugin: function load_plugin(pluginName, options) {
    if (!_.isString(pluginName)) {
      throw "Argument must be a module name";
    }
    return (
      Plugin.resolve_plugin(pluginName)
      .then(function(pluginFile) {
        var pluginModule;
        if (pluginFile) {
          pluginModule = require(pluginFile);
        } else {
          // Try a direct require if all else fails
          pluginModule = require(pluginName);
        }
        var pluginInstance = new Plugin(pluginModule, options);
        return pluginInstance;
      })
    );
  },

  resolve_plugin: function resolve_plugin(name) {
    var pluginPaths = Plugin.resolve_plugin_paths(name);
    var checkNextFile = function() {
      var file = pluginPaths.pop();
      if (!file) {
        throw "Can't resolve plugin name: " + name;
      }
      return checkFile(file);
    };
    var checkFile = function(file) {
      return new Promise(function(resolve, reject) {
        fs.access(file, fs.R_OK, function(err) {
          if (err) {
            resolve(checkNextFile());
          } else {
            resolve(file);
          }
        });
      });
    };
    return checkNextFile();
  },

  resolve_plugin_paths: function resolve_plugin_paths(name) {
    // Absolute path
    if (path.isAbsolute(name)) {
      return [name];
    }
    // Relative path
    if (_.startsWith(name, '.')) {
      var subpaths = Plugin.resolve_plugin_subpath(name, '.');
      // Use the second entry, since the first entry is Octobot
      return [path.resolve(subpaths[1])];
    }
    // Else look for the plugin in the plugin dir
    return Plugin.resolve_plugin_subpath(name, plugin_resolve_subpath).reverse();
  },

  resolve_plugin_subpath: function resolve_plugin_subpath(name, subpath) {
    var pluginPaths = [];
    var modPath = [];
    var depth = plugin_max_resolve_depth;
    while (depth--) {
      modPath.push('parent');
      var parentModule = _.get(module, modPath.join('.'));
      if (!_.isObject(parentModule)) break;
      var testPath = util.format(
        '%s/%s/%s.js',
        path.dirname(parentModule.filename),
        subpath,
        name
      );
      // Squelch dupes
      if (testPath !== _.last(pluginPaths)) {
        pluginPaths.push(path.resolve(testPath));
      }
    }
    return pluginPaths;
  }
});

// Plugin prototype methods
_.extend(Plugin.prototype, {
  name: 'plugin-base',
  prefix: '',
  init: function() {},
  listeners: {},

  init_emitters: function init_emitters() {
    EventEmitter.call(this, emitter_options);
    var emitter = this;
    // Add base plugin listeners
    _.forEach(Listeners, function(l, n) {
      this.addListener(n, l);
    }, this);
    // Add plugin instance listeners
    _.forEach(this.listeners, function(l, n) {
      this.addListener(n, l);
    }, this);
  },

  destroy: function destroy() {
    this.removeAllListeners();
  },

  populate_command_map: function populate_command_map() {
    this.command_map = (
      _(this.commands)
      .map(function(command, name) {
        if (!_.isFunction(command.response)) return;
        var trigger = (this.prefix || '') + name;
        if (!command.no_space) trigger += ' ';
        return [trigger, command];
      }, this)
      .zipObject()
      .value()
    );
  },

  create_event: function create_event() {
    // todo! for emitP.
  },

  dispatch: function dispatch(event) {
    // hwo to promise
    // return this.emitPromise.
    var args = _.slice(arguments, 1);
    var p = new Promise(function(resolve, reject) {
      var evt = {
        origin: this.name,
        resolve: resolve,
        reject: reject,
        event: event,
        args: args
      };
      evt.args.unshift(evt.event, evt);
      this.emit('plugin:dispatch', evt);
    }.bind(this));
    return p.bind(this);
  },

  // Emit an event to self, returning a promise
  // Emitted events receive a Promise as first argument
  // This is also used by bot's .dispatch()
  emitPromise: function emitPromise(event) {
    var args = _.toArray(arguments).slice(1);
    var p = new Promise(function(resolve, reject) {
      args.unshift(event, {
        resolve: resolve,
        reject: reject
      });
      this.emit.apply(this, args);
    }.bind(this));
    return p.bind(this);
  },

  // TODO: Deprecate
  // Return a promise that resolves when a data object passes the validator
  queueExpect: function queueExpect(name, validator) {
    this.expect_queue = this.expect_queue || {};
    var queue = this.expect_queue;
    if (!_.isArray(this.expect_queue[name])) {
      queue[name] = [];
    }
    var p = new Promise(function(resolve, reject) {
      queue[name].push({
        resolve: resolve,
        validator: validator
      });
    });
    this.dispatch('log:debug', 'Expecting:', name);
    return p.bind(this);
  },

  // TODO: Deprecate
  queueExpectKeys: function queueExpectKeys(name, data, keys) {
    return this.queueExpect(name, function(test) {
      return keys.every(function(k) {
        return (data[k] === test[k]);
      });
    });
  },

  // TODO: Deprecate
  // See if the supplied data matches an item in the queue
  queueResolve: function queueResolve(name, data) {
    if (!this.expect_queue || !this.expect_queue[name]) return;
    var out_queue = [];
    var resolved = 0, pending = 0, pruned = 0;
    _.forEach(this.expect_queue[name], function(item) {
      if (_.isObject(item) && _.isFunction(item.resolve)) {
        if (item.validator(data)) {
          // Resolve it
          item.resolve(data);
          resolved++;
        } else {
          // Item not yet resolved, keep in queue
          out_queue.push(item);
          pending++;
        }
      } else {
        pruned++;
      }
    });
    this.expect_queue[name] = out_queue;
    if (resolved > 0) {
      this.dispatch('log:debug', 'Queue', name, '-', 'Resolved:', resolved, 'Pending:', pending, 'Pruned:', pruned);
    }
    return resolved;
  }
});

// Aliases
Plugin.prototype.emitP = Plugin.prototype.emitPromise;

// Listeners?
var Listeners = {
  'irc:message': function messageListener(evt, irc) {
    // Look for a command handler
    var input = irc.text + ' ';
    if (!Object.keys(this.command_map).some(function(cmd) {
      if (input.indexOf(cmd) === 0) {
        // Found a match
        var msg = irc.text.substr(cmd.length).trim();
        var params = msg.split(' ');
        if (params[0] === '') params = [];
        irc = _.extend({}, irc, {
          handler: this.command_map[cmd],
          command: cmd.trim(),
          msg: msg,
          params: params,
        });
        if (irc.handler.response) {
          // Execute handler
          irc.handler.response.call(this, evt, irc);
        }
        // Stop after first match
        return true;
      }
    }, this)) {
      // Couldn't find handler
    }
  }
};
