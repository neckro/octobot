"use strict";
var _ = require('lodash');
var format = require('util').format;
var Promise = require('bluebird');

var sqlite3 = require('sqlite3');

module.exports = {
  name: 'database',
  defaults: {
    db_path: './db/save.db'
  },
  init: function() {
    return this.init_sqlite();
  },
  init_sqlite: function() {
    return new Promise(function(resolve, reject) {
      this.db = new (sqlite3.verbose().Database)(
        this.config.db_path,
        function(error) {
          if (_.isNull(error)) return resolve();
          return reject(error);
        }
      );
      this.db.addListener('error', function(error) {
        this.dispatch('log:error', 'Database error', error);
      }.bind(this));
    }.bind(this));
  }
};

module.exports.listeners = {
  'db:insert': function(evt, table, o, obj_keys) {
    if (
      typeof o !== 'object' ||
      typeof table !== 'string'
    ) return evt.resolve(Promise.reject('Bad parameters'));
    if (!Array.isArray(obj_keys)) {
      obj_keys = Object.keys(o);
    }
    var keys = [], placeholders = [], values = [], c = 1;
    obj_keys.forEach(function(k) {
      if (typeof o[k] === 'undefined') return;
      keys.push(k);
      placeholders.push('?' + c++);
      values.push(o[k]);
    });
    if (keys.length > 0) {
      var query = format(
        'REPLACE INTO %s (%s) VALUES (%s)',
        table,
        keys.join(', '),
        placeholders.join(', ')
      );
      evt.resolve(this.emitP('db:run', query, values));
    }
  },
  'db:run': function(evt) {
    var args = _.slice(arguments, 1);
    // Allow an array to be sent instead
    if (_.isArray(args[0])) {
      args[0] = args[0].join(' ');
    }
    evt.resolve(Promise.promisify(this.db.run).apply(this.db, args));
  },
  'db:call': function(evt, func) {
    if (typeof this.db[func] !== 'function') {
      return evt.reject('Invalid DB call: ' + func);
    }
    var args = _.slice(arguments, 2);
    evt.resolve(Promise.promisify(this.db[func]).apply(this.db, args));
  }
};
