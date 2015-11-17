"use strict";
var _ = require('lodash');
var format = require('util').format;

module.exports = {
  name: "dictionary",
  init: function() {
    this.dispatch('db:run', [
      'CREATE TABLE IF NOT EXISTS dictionary (',
        'term TEXT PRIMARY KEY NOT NULL,',
        'def TEXT,',
        'updated DATETIME DEFAULT CURRENT_TIMESTAMP',
      ');'
    ]);
  }
};

module.exports.commands = {
  "!dbadd": {
    description: "!dbadd <term> <entry>: Add an entry to the database. Use {braces} if term is multiple words!",
    response: function(evt, msg) {
      var parsed = msg.msg.match(/^((\{(.+)\})|([^ ]+)) (.*)$/);
      if (!parsed || parsed.length < 5) {
        msg.reply('Bad entry!');
        return;
      }
      var term = (parsed[4] || parsed[3]).toLowerCase();
      var def = parsed[5];
      this.dispatch('db:run', 'REPLACE INTO dictionary (term, def) VALUES (?, ?)', term, def)
      .then(function(v) {
        msg.reply('Entry saved for %s.', term);
      })
      .catch(function(e) {
        this.dispatch('log:error', e);
        msg.reply('Database error!');
      });
    }
  },
  "!dbremove": {
    description: "Remove an entry from the database.",
    response: function(evt, msg) {
      var term = msg.msg.toLowerCase();
      this.dispatch('db:run', 'DELETE FROM dictionary WHERE term = ?', msg.msg)
      .then(function(v) {
        msg.reply('Trog destroy entry for %s.', term);
      })
      .catch(function(e) {
        this.dispatch('log:error', e);
        msg.reply('Database error!');
      });
    }
  },
  "!dblist": {
    description: "List all terms in the database.",
    response: function(evt, msg) {
      this.dispatch('db:call', 'all', 'SELECT term FROM dictionary ORDER BY term')
      .then(function(v) {
        if (v.length === 0) return;
        var terms = '';
        _.each(v, function(r) {
          if (typeof r.term === 'string') terms += '{' + r.term + '} ';
        });
        msg.reply(terms);
      })
      .catch(function(e) {
        this.dispatch('log:error', e);
        msg.reply('Database error!');
      });
    }
  },
  "?!": {
    description: "Show an entry from the database.  Use !dbadd to add new terms.",
    no_space: true,
    response: function(evt, msg) {
      var term = msg.msg.trim();
      if (term.length && term.length > 0) {
        this.dispatch('db:call', 'get', 'SELECT def FROM dictionary WHERE term = ?', term)
        .then(function(v) {
          if (v && typeof v.def === 'string') {
            msg.reply('{%s}: %s', term.toUpperCase(), v.def);
          } else {
            msg.reply('No definition for {%s}', term);
          }
        })
        .catch(function(e) {
          this.dispatch('log:error', e);
          msg.reply('Database error!');
        });
      }
    }
  }
};
