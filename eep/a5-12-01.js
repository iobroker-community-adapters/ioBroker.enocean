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
    var ti = (telegram.userData[3]) >> 4;
    var dt = (telegram.userData[3]) >> 2;
    dt = dt << 15;
    var div = (telegram.userData[3]) << 14;
    div = div >>> 16;
    var value = telegram.userData.slice(0, 3).toString("hex");
    var testval= telegram.userData.toString("hex");

    var unit;

    if(dt == 0){
        unit = 'kWh'
    }else if (dt == 98304){
        unit = 'W';
    }

    //get divisor for power
    var divN;
    switch(div){
        case(3):
            divN = 1;
            break;
        case(2):
            divN = 10;
            break;
        case(1):
            divN = 100;
            break;
        case(0):
            divN = 1000;
            break;
    }



    retValue['learn_button'] = (lb === 1);
    if (1 === lb) {
        if(dt == 98304){
            retValue['power'] = parseInt(value, 16)/divN;
        } else{
            retValue['energy_counter'] = parseInt(value, 16)/divN;
        }

        retValue['ti'] = ti;
    }

    return retValue;
}