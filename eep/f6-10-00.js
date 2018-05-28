"use strict";

// required for autocompletion
const RadioTelegram = require('../lib/esp3Packet').RadioTelegram;

const T21_FLAG = 0b00100000;
const NU_FLAG = 0b00010000;

/**
 * @param {RadioTelegram} telegram
 * @returns {{window_handle: 0 | 1 | 2}}
 */
module.exports = function (telegram) {

    const T21 = (telegram.status & T21_FLAG) === T21_FLAG;
    const NU = (telegram.status & NU_FLAG) === NU_FLAG;

    const dataField = telegram.userData[0];

    if (T21 && !NU) {
        // message
        let handleOpen = ((dataField & 0xD0) == 0xC0);
        let handleTilt = ((dataField & 0xF0) == 0xD0);

        if (handleOpen) {
            return { window_handle: 1 };
        } else if (handleTilt) {
            return { window_handle: 2 };
        } else {
            return { window_handle: 0 };
        }
    }
};
