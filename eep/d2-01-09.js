"use strict";

// required for autocompletion
const RadioTelegram = require('../lib/esp3Packet').RadioTelegram;

/**
 * @param {RadioTelegram} telegram
 */
module.exports = function (telegram) {
    // message
    var retValue = {};
    var lb = (telegram.userData[3] & 0x000008) >> 3;
    var valueDB1 = telegram.userData[2];
    var valueDB3 = telegram.userData[0];


    retValue['learn_button'] = (lb === 1);
    if (1 === lb) {
        retValue['presence'] = (valueDB1 >= 128);
        retValue['svc'] = valueDB3 * (5.0/250);
    }

    return retValue;
}