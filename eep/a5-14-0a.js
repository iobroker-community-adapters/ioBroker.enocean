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
    let svc = (telegram.userData[3]);
    let ct = (telegram.userData[3] & 0x06) >> 1;
    let vib = (telegram.userData[3] & 0x01);

    retValue['learn_button'] = (lb === 1);
    if (1 === lb) {

        retValue['svc'] = svc * (5.0/250);
        retValue['vib'] = vib;
        retValue['ct'] = ct;
    }

    return retValue;
};