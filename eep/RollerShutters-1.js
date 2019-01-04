"use strict";

// required for autocompletion
const RadioTelegram = require('../lib/esp3Packet').RadioTelegram;

const T21_FLAG = 0b00100000;
const NU_FLAG = 0b00010000;

/** @typedef {"byte0"|"byte1"|"byte2"|"byte3"} DataPayLoad  */
// /** @type {DataPayload[]} */
const DataPayLoad = ["byte0", "byte1", "byte2", "byte3"];

/**
 * @param {RadioTelegram} telegram 
 */
module.exports = function (telegram) {

  let retValue = {};

  const RORG = telegram.type.toString(16)
  DataPayLoad["byte0"] = telegram.userData[0];
  DataPayLoad["byte1"] = telegram.userData[1];
  DataPayLoad["byte2"] = telegram.userData[2];
  DataPayLoad["byte3"] = telegram.userData[3];
  
  // Debug
  console.log("RORG: '" + RORG + "'" + 
              " datafield0: '" + DataPayLoad["byte0"] +"'" + 
              " datafield1: '" + DataPayLoad["byte1"] +"'" + 
              " datafield2: '" + DataPayLoad["byte2"] +"'" + 
              " datafield3: '" + DataPayLoad["byte3"] +"'");
  
  // handle different message types
  switch(RORG){
    case 'a5':
      retValue = {
        "data1": DataPayLoad["byte0"],
        "data2": DataPayLoad["byte1"],
        "data3": DataPayLoad["byte2"],
        "data4": DataPayLoad["byte3"]
      };
      break;
    case 'f6':
        // nothing yet
      break;
    default:
      console.log("Unknown Message Type - RORG: '" + RORG + "'" + 
                  " datafield0: '" + DataPayLoad["byte0"] +"'" + 
                  " datafield1: '" + DataPayLoad["byte1"] +"'" + 
                  " datafield2: '" + DataPayLoad["byte2"] +"'" + 
                  " datafield3: '" + DataPayLoad["byte3"] +"'");
  }

  return retValue;
};