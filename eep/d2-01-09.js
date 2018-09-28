"use strict";

// required for autocompletion
const RadioTelegram = require('../lib/esp3Packet').RadioTelegram;

/**
 * @param {RadioTelegram} telegram
 */
module.exports = function (telegram) {
    // message
    let retValue = {};
    let cmd = (telegram.userData[0] & 0xF).toString(16);

    let oc;     //Over current switch off
    let el;     //Error Level
    let io;     //I/O channel
    let lc;     //Local control for device
    let ov;     //Output value
    let de;     //Taught-in devices
    let dv;     //Dim value
    let un;     //Unit
    let mv;     //Measurement value


    switch(cmd){
        case '4':       //Actuator Status Response
            oc = (telegram.userData[1]) >> 7;
            el = (telegram.userData[1] & 0x60) >> 5;
            io = (telegram.userData[1] & 0x1F);
            lc = (telegram.userData[2]) >> 7;
            ov = (telegram.userData[2] & 0x7F);
            break;
        case '7':       //Actuator Measurement Response
            mv = (telegram.userData[2] + telegram.userData[3] + telegram.userData[4] + telegram.userData[5]);
            un = (telegram.userData[1] & 0xE0) >> 5;
            io = (telegram.userData[1] & 0x1F);
            break;
    }


    retValue['cmd'] = cmd;
    if(oc !== undefined){
        retValue['oc']  = oc.toString(16);
    }
    if(el !== undefined){
        retValue['el']  = el;
    }
    if(io !== undefined){
        retValue['io']  = io.toString(16);
    }
    if(lc !== undefined){
        retValue['lc']  = lc.toString(16);
    }
    if(ov !== ov){
        retValue['ov']  = ov.toString(16);
    }

    return retValue;
};

module.exports = function command(id, cmd){

    switch(cmd){
        case 1:     //Actuator Set Output
            console.log('test');
            break;
    }
};