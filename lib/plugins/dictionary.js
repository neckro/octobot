'use strict';
const _ = require('lodash');

module.exports = {
  name: 'dictionary',
  init: function () {
    this.dispatch('db:exec', `
      DROP TABLE IF EXISTS _dictionary;
      CREATE TABLE _dictionary (
        term TEXT PRIMARY KEY NOT NULL COLLATE NOCASE,
        def TEXT,
        updated DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT OR IGNORE INTO _dictionary SELECT * FROM dictionary;
      DROP TABLE IF EXISTS dictionary;
      ALTER TABLE _dictionary RENAME TO dictionary;
    `);
  }
};

module.exports.commands = {
  '!dbadd': {
    description: '!dbadd <term> <entry>: Add an entry to the database. Use {braces} if term is multiple words!',
    response: function (evt, msg) {
      const parsed = msg.msg.match(/^((\{(.+)\})|([^ ]+)) (.*)$/);
      if (!parsed || parsed.length < 5) {
        msg.reply('Bad entry!');
        return;
      }
      const term = (parsed[4] || parsed[3]);
      const def = parsed[5];
      this.dispatch('db:run', 'REPLACE INTO dictionary (term, def) VALUES (?, ?)', term, def)
        .then(v => {
          msg.reply(`Entry saved for ${term}.`);
        })
        .catch(e => {
          this.dispatch('log:error', e);
          msg.reply('Database error!');
        });
    }
  },
  '!dbremove': {
    description: 'Remove an entry from the database.',
    response: function (evt, msg) {
      const term = msg.msg.trim();
      this.dispatch('db:run', 'DELETE FROM dictionary WHERE term = ?', term)
        .then(v => {
          msg.reply(`Trog destroy entry for ${term}.`);
        })
        .catch(e => {
          this.dispatch('log:error', e);
          msg.reply('Database error!');
        });
    }
  },
  '!dblist': {
    description: 'List all terms in the database.',
    response: function (evt, msg) {
      this.dispatch('db:call', 'all', 'SELECT term FROM dictionary ORDER BY term')
        .then(result => {
          if (result.length === 0) return;
          const terms = _.map(result, row => row.term);
          msg.reply(terms.join(' '));
        })
        .catch(e => {
          this.dispatch('log:error', e);
          msg.reply('Database error!');
        });
    }
  },
  '?!': {
    description: 'Show an entry from the database.  Use !dbadd to add new terms.',
    no_space: true,
    response: function (evt, msg) {
      const term = msg.msg.trim();
      if (term.length && term.length > 0) {
        this.dispatch('db:call', 'get', 'SELECT term, def FROM dictionary WHERE term = ?', term)
          .then(result => {
            const def = _.get(result, 'def');
            if (def) {
              msg.reply(`{${result.term}}: ${def}`);
            } else {
              msg.reply(`No definition for {${term}}.`);
            }
          })
          .catch(e => {
            this.dispatch('log:error', e);
            msg.reply('Database error!');
          });
      }
    }
  }
};
