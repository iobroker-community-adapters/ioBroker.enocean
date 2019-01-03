"use strict";

// required for autocompletion
const RadioTelegram = require('../lib/esp3Packet').RadioTelegram;

const T21_FLAG = 0b00100000;
const NU_FLAG = 0b00010000;

/** @typedef {"byte0"|"byte1"|"byte2"|"byte3"} DataPayload  */
// /** @type {DataPayload[]} */
const DataPayload = ["byte0", "byte1", "byte2", "byte3"];

console.log("test");

/**
 * @param {RadioTelegram} telegram 
 */
module.exports = function (telegram) {

  let retValue = {};

  return retValue;
};