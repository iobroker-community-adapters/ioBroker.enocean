"use strict";

// required for autocompletion
const RadioTelegram = require('../lib/esp3Packet').RadioTelegram;

/**
 * DEFAULT parser for unknown packets
 */

/**
 * @param {RadioTelegram} telegram 
 */
module.exports = function (telegram) {
    let retValue = {};
        retValue['raw'] = telegram.userData.toString("hex");
        retValue['type'] = telegram.type;
    return retValue;
};
