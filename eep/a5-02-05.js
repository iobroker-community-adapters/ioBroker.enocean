"use strict";

// required for autocompletion
const RadioTelegram = require('../lib/esp3Packet').RadioTelegram;

/**
 * @param {RadioTelegram} telegram 
 */
module.exports = function (telegram) {
  // message
  const dataField = telegram.userData[0];
  var retValue = {};
  var lb = (dataField & 0x00000008) >> 3;
  var value = (dataField & 0x0000FF00) >> 8;

  retValue['learn_button'] = (lb === 1);
  if (1 === lb) {
    retValue['temperature'] = Math.trunc((value * 40 / 255 + 0.05) * 10) / 10;
  }

  return retValue;
}
