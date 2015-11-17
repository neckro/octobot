"use strict";
var util = require('util');

var _ = require('lodash');
var Promise = require('bluebird');
var EventEmitter = require('eventemitter2').EventEmitter2;
// var blessed = require('blessed');

var ConsolePlugin = module.exports = function ConsolePlugin() {
  EventEmitter.call(this);

  this.onAny(function(e) {
    console.log(e);
  });
};

util.inherits(ConsolePlugin, EventEmitter);

_.extend(ConsolePlugin.prototype, {
  connect: function start() {
    throw "Console not implemented yet";
  }
});
