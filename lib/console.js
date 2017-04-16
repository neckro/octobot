'use strict';

const EventEmitter = require('eventemitter2').EventEmitter2;

module.exports = class ConsolePlugin extends EventEmitter {
  constructor () {
    super();
    this.onAny(function (e) {
      // console.log(e);
    });
  }

  connect () {
    throw 'Console not implemented yet';
  }

};
