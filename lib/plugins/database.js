'use strict';
const _ = require('lodash');
const Promise = require('bluebird');
const sqlite3 = require('sqlite3');

module.exports = {
  name: 'database',
  defaults: {
    db_path: './db/save.db'
  },
  init: function () {
    return this.init_sqlite();
  },
  init_sqlite: function () {
    return new Promise((resolve, reject) => {
      this.db = new (sqlite3.verbose().Database)(
        this.config.db_path,
        error => _.isNull(error) ? resolve() : reject(error)
      );
      this.db.addListener('error', error => {
        this.dispatch('log:error', 'Database error', error);
      });
    });
  }
};

module.exports.listeners = {
  'db:insert': function (evt, table, o, obj_keys) {
    if (
      typeof o !== 'object' ||
      typeof table !== 'string'
    ) return evt.resolve(Promise.reject('Bad parameters'));
    if (!Array.isArray(obj_keys)) {
      obj_keys = Object.keys(o);
    }
    const keys = [], placeholders = [], values = [];
    let c = 1;
    obj_keys.forEach(k => {
      if (typeof o[k] === 'undefined') return;
      keys.push(k);
      placeholders.push('?' + c++);
      values.push(o[k]);
    });
    if (keys.length > 0) {
      const query = `REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders.join(',')})`;
      evt.resolve(this.emitP('db:run', query, values));
    }
  },
  'db:run': function (evt, ...args) {
    if (_.isArray(args[0])) args[0] = args[0].join(' ');
    evt.resolve(Promise.promisify(this.db.run).apply(this.db, args));
  },
  'db:exec': function (evt, ...args) {
    if (_.isArray(args[0])) args[0] = args[0].join(' ');
    evt.resolve(Promise.promisify(this.db.exec).apply(this.db, args));
  },
  'db:call': function (evt, func, ...args) {
    if (typeof this.db[func] !== 'function') {
      return evt.reject('Invalid DB call: ' + func);
    }
    evt.resolve(Promise.promisify(this.db[func]).apply(this.db, args));
  }
};
