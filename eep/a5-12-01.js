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
    let ti = (telegram.userData[3]) >> 4;
    let dt = (telegram.userData[3]) >> 2;
    dt = dt << 15;
    let div = (telegram.userData[3]) << 14;
    div = div >>> 16;
    let value = telegram.userData.slice(0, 3).toString("hex");
    let testval= telegram.userData.toString("hex");

    let unit;

    if(dt == 0){
        unit = 'kWh'
    }else if (dt == 98304){
        unit = 'W';
    }

    //get divisor for power
    let divN;
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
};