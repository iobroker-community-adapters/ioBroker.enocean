"use strict";

// required for autocompletion
const RadioTelegram = require('../lib/esp3Packet').RadioTelegram;

const T21_FLAG = 0b00100000;
const NU_FLAG = 0b00010000;

/** @typedef {"A1"|"A0"|"B1"|"B0"} RockerAction  */
/** @type {RockerAction[]} */
const RockerActions = ["A1", "A0", "B1", "B0"];

/**
 * @param {RadioTelegram} telegram 
 * @returns {{[K in RockerAction]?: boolean | "toggle"}}
 */
module.exports = function (telegram) {

  const T21 = (telegram.status & T21_FLAG) === T21_FLAG;
  const NU = (telegram.status & NU_FLAG) === NU_FLAG;

  const dataField = telegram.userData[0];

  if (T21 && NU) {
    switch (dataField) {
      case 0x30:
        return {
          A0: true,
          A1: false
        };

      case 0x10:
        return {
          A0: true,
          A1: 'toggle'
        };

      case 0x70:
        return {
          B0: true,
          B1: false
        };

      case 0x50:
        return {
          B0: false,
          B1: true
        };

      default:
        return {
          A0: false,
          A1: false,
          B0: false,
          B1: false
        };

    }
  }

};
