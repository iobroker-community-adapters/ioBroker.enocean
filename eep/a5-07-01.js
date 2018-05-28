"use strict";

// required for autocompletion
const RadioTelegram = require('../lib/esp3Packet').RadioTelegram;

/**
 * @param {RadioTelegram} telegram
 */
module.exports = function (telegram) {
    // message
    let retValue = {};
    let lb = (telegram.userData[3] & 0x000008) >> 3;
    let valueDB1 = telegram.userData[2];
    let valueDB3 = telegram.userData[0];


    retValue['learn_button'] = (lb === 1);
    if (1 === lb) {
        retValue['presence'] = (valueDB1 >= 128);
        retValue['svc'] = valueDB3 * (5.0/250);
    }

    return retValue;
}