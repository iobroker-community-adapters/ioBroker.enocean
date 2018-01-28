"use strict";

// required for autocompletion
const RadioTelegram = require('../lib/esp3Packet').RadioTelegram;

/**
 * @param {RadioTelegram} telegram 
 */
module.exports = function (telegram) {
    // message
    const dataField = telegram.userData[0];
    var handleOpen = ((dataField & 0x01) === 0x00);
    var learnButton = ((dataField & 0x08) === 0x00);

    return { contact_status: handleOpen, learn_button: learnButton };
}
