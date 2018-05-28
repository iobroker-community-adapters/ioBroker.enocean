"use strict";

// required for autocompletion
const RadioTelegram = require('../lib/esp3Packet').RadioTelegram;

const T21_FLAG = 0b00100000;
const NU_FLAG = 0b00010000;

/**
 * @param {RadioTelegram} telegram
 */
module.exports = function (telegram) {

    let retValue = {};

    const T21 = (telegram.status & T21_FLAG) === T21_FLAG;
    const NU = (telegram.status & NU_FLAG) === NU_FLAG;

    if (T21 && !NU) {
        // keep alive
        retValue = { keep_alive: true, alarm: false, battery_status: true };
    } else {
        // message
        const dataField = telegram.userData[0];

        let SA = dataField & 0x01;
        let R1 = (dataField & 0xE0) >> 5;
        let EB = ((dataField & 0x10) === 0x10);

        switch (R1) {
            case 0:
                if (!EB) {
                    retValue = { alarm: false, keep_alive: true };
                } else {
                    retValue = { alarm: true, keep_alive: true };
                }
                break;
            case 1:
                if (EB) {
                    retValue = { battery_status: false, keep_alive: true };
                }
                break;
            case 2:
                break;
            case 3:
                break;
        }
    }
    return retValue;
};
