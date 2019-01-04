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

  const RORG = telegram.type.toString(16);
  console.log("RORG: '" + RORG + "'");
  
//   const DataByte0 = telegram.userData.data[0].toString(16);
//   const DataByte1 = telegram.userData.data[1].toString(16);
//   const DataByte2 = telegram.userData.data[2].toString(16);
//   const DataByte3 = telegram.userData.data[3].toString(16);
//   const Status = telegram.status.toString(16);
  
  retValue = {"type": RORG, "type_int": telegram.type};

  // Distinguish between BS4 (a5) and RPS (f6)
//   if (RORG == 0xA5){ 
//     // BS4
//     retValue['data1'] = telegram.userData.data[0];
//     retValue['data2'] = telegram.userData.data[1];
//     retValue['data3'] = telegram.userData.data[2];
//     retValue['data4'] = telegram.userData.data[3];
//     retValue = {"type": RORG, "byte0": DataByte0, "byte1": DataByte1, "byte2": DataByte2, "byte3": DataByte3, "ststus": Status};

//   } else if (RORG == 0xF6) { 
//     // RPS
//     retValue = {"type": RORG, "byte0": DataByte0, "byte1": DataByte1, "byte2": DataByte2, "byte3": DataByte3, "ststus": Status};
  
//   } else { 
//     // unknown -> Debug output of data
//     retValue = {"type": RORG, "byte0": DataByte0, "byte1": DataByte1, "byte2": DataByte2, "byte3": DataByte3, "ststus": Status};
//   }

  return retValue;
};