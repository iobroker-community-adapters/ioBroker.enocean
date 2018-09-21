"use strict";

// required for autocompletion
const RadioTelegram = require('../lib/esp3Packet').RadioTelegram;

/**
 * @param {RadioTelegram} telegram 
 */
module.exports = function (telegram) {
  // message
  let retValue = {};
  let lb = (telegram.userData[3] & 0x00000008) >> 3;
  let value = telegram.userData[2];

  retValue['learn_button'] = (lb === 1);
  if (1 === lb) {
    let result =  ((value -255)*(40/255));
    retValue['temperature'] = result.toFixed(2);
  }

  return retValue;
};
