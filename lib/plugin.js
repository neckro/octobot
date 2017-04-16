'use strict';
const fs = require('fs');
const path = require('path');
const util = require('util');

const _ = require('lodash');
const Promise = require('bluebird');
const EventEmitter = require('eventemitter2').EventEmitter2;

const plugin_resolve_subpath = 'plugins';
const plugin_max_resolve_depth = 10;

const emitter_options = {
  wildcard: true,
  delimiter: ':',
  maxListeners: 50
};

module.exports = class Plugin extends EventEmitter {
  constructor (pluginModule, pluginOptions) {
    super(emitter_options);
    _.extend(this, pluginModule);
    this.config = _.extend({},
      this.config,
      _.cloneDeep(this.defaults),
      _.cloneDeep(pluginOptions)
    );

    // Add base plugin listeners
    _.forEach(Listeners, (l, n) => this.addListener(n, l));
    // Add plugin instance listeners
    _.forEach(pluginModule.listeners, (l, n) => this.addListener(n, l));

    this.populate_command_map();

    this.once('start', function () {
      let initPromise;
      if (_.isFunction(this.init)) {
        initPromise = this.init(pluginOptions);
      }
      Promise.resolve(initPromise)
        .then(() => {
          this.dispatch('plugin:loaded');
        })
        .catch(err => {
          this.dispatch('log:error', err);
          this.dispatch('plugin:failure');
        });
    });
  }

  static load_plugin (pluginName, pluginOptions) {
    if (!_.isString(pluginName)) {
      throw new Error('Argument must be a module name');
    }
    return (
      Plugin.resolve_plugin(pluginName)
        .then(function (pluginFile) {
          let pluginModule;
          if (pluginFile) {
            pluginModule = require(pluginFile);
          } else {
            // Try a direct require if all else fails
            pluginModule = require(pluginName);
          }
          const pluginInstance = new Plugin(pluginModule, pluginOptions);
          return pluginInstance;
        })
    );
  }

  static resolve_plugin (name) {
    const pluginPaths = Plugin.resolve_plugin_paths(name);
    function checkNextFile () {
      const file = pluginPaths.pop();
      if (!file) {
        throw `Can't resolve plugin name: ${name}`;
      }
      return checkFile(file);
    }
    function checkFile (file) {
      return new Promise(resolve => {
        fs.access(file, fs.R_OK, err => {
          if (err) {
            resolve(checkNextFile());
          } else {
            resolve(file);
          }
        });
      });
    }
    return checkNextFile();
  }

  static resolve_plugin_paths (name) {
    // Absolute path
    if (path.isAbsolute(name)) {
      return [name];
    }
    // Relative path
    if (_.startsWith(name, '.')) {
      const subpaths = Plugin.resolve_plugin_subpath(name, '.');
      // Use the second entry, since the first entry is Octobot
      return [path.resolve(subpaths[1])];
    }
    // Else look for the plugin in the plugin dir
    return Plugin.resolve_plugin_subpath(name, plugin_resolve_subpath).reverse();
  }

  static resolve_plugin_subpath (name, subpath) {
    const pluginPaths = [];
    const modPath = [];
    let depth = plugin_max_resolve_depth;
    while (depth--) {
      modPath.push('parent');
      const parentModule = _.get(module, modPath.join('.'));
      if (!_.isObject(parentModule)) break;
      const testPath = util.format(
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

  destroy () {
    this.removeAllListeners();
  }

  populate_command_map () {
    this.command_map = (
      _(this.commands)
      .map(function (command, name) {
        if (!_.isFunction(command.response)) return;
        let trigger = (this.prefix || '') + name;
        if (!command.no_space) trigger += ' ';
        return [trigger, command];
      }, this)
      .zipObject()
      .value()
    );
  }

  create_event () {
    // todo! for emitP.
  }

  dispatch (event, ...args) {
    return new Promise((resolve, reject) => {
      const evt = {
        origin: this.name,
        resolve: resolve,
        reject: reject,
        event: event,
        args: args
      };
      evt.args.unshift(evt.event, evt);
      this.emit('plugin:dispatch', evt);
    });
  }

  // Emit an event to self, returning a promise
  // Emitted events receive a Promise as first argument
  // This is also used by bot's .dispatch()
  emitPromise (event, ...args) {
    const p = new Promise((resolve, reject) => {
      args.unshift(event, {
        resolve: resolve,
        reject: reject
      });
      this.emit(...args);
    });
    return p.bind(this);
  }

  // Alias for emitPromise
  emitP (...args) {
    return this.emitPromise(...args);
  }

  // TODO: Deprecate
  // Return a promise that resolves when a data object passes the validator
  queueExpect (name, validator) {
    this.expect_queue = this.expect_queue || {};
    const queue = this.expect_queue;
    if (!_.isArray(this.expect_queue[name])) {
      queue[name] = [];
    }
    const p = new Promise((resolve) => {
      queue[name].push({
        resolve: resolve,
        validator: validator
      });
    });
    this.dispatch('log:debug', 'Expecting:', name);
    return p.bind(this);
  }

  // TODO: Deprecate
  queueExpectKeys (name, data, keys) {
    return this.queueExpect(name, test => {
      return keys.every(k => (data[k] === test[k]));
    });
  }

  // TODO: Deprecate
  // See if the supplied data matches an item in the queue
  queueResolve (name, data) {
    if (!this.expect_queue || !this.expect_queue[name]) return;
    const out_queue = [];
    let resolved = 0, pending = 0, pruned = 0;
    _.forEach(this.expect_queue[name], item => {
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

};

// Listeners?
const Listeners = {
  'irc:message': function messageListener (evt, irc) {
    // Look for a command handler
    const input = irc.text + ' ';
    if (!Object.keys(this.command_map).some(cmd => {
      if (input.indexOf(cmd) === 0) {
        // Found a match
        const msg = irc.text.substr(cmd.length).trim();
        let params = msg.split(' ');
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
    })) {
      // Couldn't find handler
    }
  }
};
