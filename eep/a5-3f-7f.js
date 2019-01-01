"use strict";

// required for autocompletion
const RadioTelegram = require('../lib/esp3Packet').RadioTelegram;

const T21_FLAG = 0b00100000;
const NU_FLAG = 0b00010000;

/** @typedef {"byte0"|"byte1"|"byte2"|"byte3"} DataPayload  */
// /** @type {DataPayload[]} */
const DataPayload = ["byte0", "byte1", "byte2", "byte3"];

/**
 * @param {RadioTelegram} telegram 
 */
module.exports = function (telegram) {

  let retValue = {};

  let RORG = telegram.type.toString("hex");
  
  // Distinguish between BS4 (a5) and RPS (f6)

  if (RORG == 0xA5){ // BS4
    retValue['type'] = telegram.type.toString("hex");
    retValue['data'] = telegram.userData.toString("hex");
    retValue['status'] = telegram.status.toString("hex");
  } else if (RORG == 0xF6) { // RPS
    retValue['type'] = telegram.type.toString("hex");
    retValue['data'] = telegram.userData.toString("hex");
    retValue['status'] = telegram.status.toString("hex");
  } else { // unknown
    retValue['type'] = telegram.type.toString("hex");
    retValue['data'] = telegram.userData.toString("hex");
    retValue['status'] = telegram.status.toString("hex");
  }

//   const T21 = (telegram.status & T21_FLAG) === T21_FLAG;
//   const NU = (telegram.status & NU_FLAG) === NU_FLAG;

//   const dataField = telegram.userData[0];
  
//   if (T21 && !NU) {
//     // this happens when the buttons are released
//     const numButtons = (dataField & 0xE0) >> 5;
//     const EB = ((dataField & 0x10) === 0x10);
//     if (numButtons === 0 && !EB) retValue = {
//       "AI": false, 
//       "A0": false, 
//       "BI": false, 
//       "B0": false
//     };

//   } else if (T21 && NU) {
//     // message
//     const SA = dataField & 0x01;
//     const R1 = (dataField & 0xE0) >> 5;
//     const R2 = (dataField & 0x0E) >> 1;
//     const EB = ((dataField & 0x10) === 0x10);

//     retValue[RockerActions[R1]] = EB;
//     if (SA) {
//       retValue[RockerActions[R2]] = EB;      
//     }
//   }
  return retValue;
};
