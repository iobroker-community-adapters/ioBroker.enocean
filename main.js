/* jshint -W097 */
// jshint strict:false
/*jslint node: true */
/*jslint es6 */
/*jslint esversion: 6 */
'use strict';

// you have to require the utils module and call adapter function
const utils = require('@iobroker/adapter-core'); // Get common adapter utils

const sP = require('serialport');
const os = require('os');
const path = require('path');
const fs = require('fs');
const SERIALPORT_PARSER_CLASS = require('./parser/parser.js');

const PLATFORM = os.platform();

// dictionary (id => obj) of all known devices
const devices = {};

// translation matrix
const TRANSLATION_MATRIX = require('./eep/EEP2IOB.json');

// structured representation for ESP3 packets
const ESP3Packet = require('./lib/esp3Packet').ESP3Packet;
const RadioTelegram = require('./lib/esp3Packet').RadioTelegram;
const ResponseTelegram = require('./lib/esp3Packet').ResponseTelegram;
const FourBSTeachIn = require('./lib/esp3Packet').FourBSTeachIn;
const UTETeachIn = require('./lib/esp3Packet').UTETeachIn;

// translation functions
const EEP_TRANSLATION = require('./eep/eepInclude.js');

// list of manufacturers, devicees and their configuration
const MANUFACTURER_LIST = require("./eep/devices.json");
const Enocean_manufacturer = require("./lib/manufacturer_list.js");

// tools
const crc8 = require("./lib/crc8.js");


// list of available serial ports
let AVAILABLE_PORTS = {};

// The serial port
let SERIAL_PORT = null;

// The ESP3 parsers
let SERIALPORT_ESP3_PARSER = null;

//Last Command code
let lastCMD = [];

const adapter = utils.Adapter({
    name: 'enocean',
    ready: main
});

//switch to teachin mode for automatic detection of new device
let teachin = false;

// convert byte to hex
function toHex(byte) {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
}

// byte array to hex
function toHexString(byteArray) {
    let s = '';
    byteArray.forEach(function (byte) {
        s += toHex(byte);
    });
    return s;
}

/**
 * Handle packet type 1 messages
 * @param {ESP3Packet} espPacket 
 */
function handleType1Message(espPacket) {

    const telegram = new RadioTelegram(espPacket);
    const senderID = telegram.senderID;
    const tType = telegram.type;

    // ID is 4 bytes long and at the end of the data plus on status byte.
    adapter.log.debug("Message for ID " + senderID + " has been received.");

    if (senderID in devices && teachin === false) {  // device is known

        if (telegram.rssi !== undefined) {
            adapter.setState(senderID + '.rssi', { val: telegram.rssi, ack: true });
        }

        let eep = devices[senderID].native.eep;
        let x = eep.length;
        for(let i = 0; i < x; i++) {
            let rorg = tType.toString(16);
            let patt = new RegExp(rorg.toUpperCase());
            let test = patt.test(eep[i]);

            if(test === true){

            let description = devices[senderID].native.desc;
            let eepEntry = eep[i].toLowerCase().replace(/-/g, "_") + '_' + description.toLowerCase();
            let callFunction = EEP_TRANSLATION[eepEntry];

            if (callFunction !== undefined) {
                // The return value is a map consisting of variable and value
                let varToSet = callFunction(telegram);
                adapter.log.debug('variables to set : ' + JSON.stringify(varToSet));
                for (let key in varToSet) {
                    let valToSet = varToSet[key];
                    if ('toggle' === valToSet) {
                        // get the state and invert it (only boolean type)
                        adapter.getState(senderID + '.' + key, function (err, state) {
                            adapter.log.debug('variable to set: ' + key);
                            adapter.setState(senderID + '.' + key, {val: !state, ack: true});
                        });
                    } else {
                        adapter.log.debug('else: ' + key);

                        if (valToSet['unit'] !== undefined) {
                            adapter.log.debug('unit is given: ' + valToSet['unit']);
                            adapter.extendObject(senderID + '.' + key, {common: {unit: valToSet['unit']}});
                            adapter.setState(senderID + '.' + key, {val: JSON.stringify(valToSet['val']), ack: true});
                        } else {
                            //adapter.setStateChanged(senderID + '.' + key, { val: valToSet, ack: true });      //nice idea but does not update the timestamp, this is necessary for my persence detectors
                            adapter.setState(senderID + '.' + key, {val: valToSet, ack: true});
                        }
                    }
                }
            }
            }
        }
    }else if(teachin === true){
        let mfrID;
        adapter.log.debug('Teachin telegram type: ' + telegram.type);
        switch(tType){
            case 165: //4BS telegram
                const teachinData = new FourBSTeachIn(telegram.userData);
                if(teachinData.teachIn === 0) {
                    mfrID = teachinData.mfrID;

                    //Teach-In variations: 0 = without EEP and Manufacturer ID, 1 = with EEP and Manufacturer ID
                    if (teachinData.LRNtype === 1) {
                        //add leading 0 if only one digit is present
                        let EEPFunc = teachinData.EEPFunc;
                        EEPFunc = EEPFunc.toString(16);
                        if (EEPFunc.length === 1) {
                            EEPFunc = EEPFunc.padStart(2, 0);
                        }
                        let EEPType = teachinData.EEPType.toString(16);
                        if (EEPType.length === 1) {
                            EEPType = EEPType.padStart(2, 0);
                        }
                        let mfr = Enocean_manufacturer.getManufacturerName(mfrID);
                        adapter.log.info(`EEP A5-${EEPFunc}-${EEPType} detected for device with ID ${telegram.senderID}, manufacturer: ${mfr}`);
                        addDevice(telegram.senderID, mfr, null, `A5-${EEPFunc}-${EEPType}`, 'native');
                    } else if (teachinData.LRNtype === 0) {
                        adapter.log.info(`Teach-In: 4BS (A5) Telegram without EEP and manufacturer ID detected, you have to add this device manually. The ID is "${telegram.senderID}"`);
                    }
                }
                break;
            case 246: //RPS telegram

                let t21 = (telegram.status & 0x40) >> 6;
                let nu  = (telegram.status & 0x20) >> 5;

                switch(t21 && nu){
                    case (1 && 1):    //EEP F6-02-xx
                        addDevice(telegram.senderID, 'ENOCEAN GMBH', null, `F6-02-01`, 'native');
                        adapter.log.info('EEP F6-02-xx detected');
                        break;
                    case (0 && 1):    //EEP F6-03-xx
                        addDevice(telegram.senderID, 'ENOCEAN GMBH', null, `F6-02-01`, 'native');
                        adapter.log.info('EEP F6-03-xx detected');
                        break;
                    case (1 && 0):    //EEP F6-10-xx
                        addDevice(telegram.senderID, 'ENOCEAN GMBH', null, `F6-10-00`, 'native');
                        adapter.log.info('EEP F6-10-xx detected');
                        break;


                }

                adapter.log.info(`Teach-In: RPS (F6) Telegram detected, you have to add this device manually if it wasn't added right now. The ID is "${telegram.senderID}"`);
                break;
            case 212: //UTE telegram
                const teachinDataUTE = new UTETeachIn(telegram.userData);

                if(teachinDataUTE.IDLSB !== null && teachinDataUTE.IDLSB !== undefined && teachinDataUTE.IDLSB !== 0){
                    mfrID = teachinDataUTE.IDLSB;
                }else{
                    mfrID = teachinDataUTE.IDMSB;
                }

                //add leading 0 if only one digit is present
                let EEPFunc = teachinDataUTE.EEPFunc;
                EEPFunc = EEPFunc.toString();
                if(EEPFunc.length === 1){
                    EEPFunc = EEPFunc.padStart(2,0);
                }
                let EEPType = teachinDataUTE.EEPType.toString();
                if(EEPType.length === 1){
                    EEPType = EEPType.padStart(2,0);
                }

                let EEPRorg = teachinDataUTE.EEPRorg.toString(16).toUpperCase();

                let mfr = Enocean_manufacturer.getManufacturerName(mfrID);

                addDevice(telegram.senderID, mfr, null, `${EEPRorg}-${EEPFunc}-${EEPType}`, 'native');

                adapter.log.info(`Teach-In: UTE Telegram detected, you have to add this device manually. The ID is "${telegram.senderID}"`);

                break;
            case 213:  //1BS telegram
                const teachinData1BS = new OneBSTeachIn(telegram.userData);

                if(teachinData1BS.teachIn === 0) {
                    adapter.log.info(`Teach-In: 1BS (D5) Telegram detected, you have to add this device manually. The ID is "${telegram.senderID}"`);
                }
                break;
            case 210:  //VLD telegram
                adapter.log.info(`Teach-In: VLD (D2) Telegram detected, you have to add this device manually. The ID is "${telegram.senderID}"`);
                break;
            case 198:   //Smart Ack Learn Request
                adapter.log.info(`Teach-In: Smart Ack Learn Request (C6) Telegram detected, you have to add this device manually. The ID is "${telegram.senderID}"`);

                break;
            case 209: //MSC - Manufacturer Specific Communication telegram
                adapter.log.info(`Teach-In: MSC (D1) Telegram detected, you have to add this device manually. The ID is "${telegram.senderID}"`);
                break;
        }

    }
}

/**
 * Handle packet type 2 messages
 * @param {ESP3Packet} espPacket
 */
function handleType2Message(espPacket) {
    const telegram = new ResponseTelegram(espPacket);
    let retCode = telegram.data[0];
    let resp = telegram.dataLength + ' ' + telegram.optionalLength;
    console.log(resp);
    switch(resp){
        case '1 0':          //Standard Response
            adapter.log.debug('Response for command ' + returnCommonCMD(lastCMD[0].toString(16)) + ' return code: ' + returnResponse(retCode.toString(16)));
            lastCMD.splice(0, 1);
            break;
        case '3 0':         //Response for CO_RD_REPEATER | CO_GET_FREQUENCY_INFO
           switch(lastCMD[0]){
               case 0x0A:
                   lastCMD.splice(0, 1);
                   let rep_enable = telegram.data[1];
                   let rep_level = telegram.data[2];

                   adapter.setState('gateway.repeater.enable', {val: rep_enable, ack: true});
                   adapter.setState('gateway.repeater.level', {val: rep_level, ack: true});
                   break;
               case 0x25:
                   lastCMD.splice(0, 1);
                   let freq;
                   let protocol;

                   switch(telegram.data[1]){
                       case 0x00:
                           freq = '315 Mhz';
                           break;
                       case 0x01:
                           freq = '868.3 Mhz';
                           break;
                       case 0x02:
                           freq = '902.875 Mhz';
                           break;
                       case 0x03:
                           freq = '925 Mhz';
                           break;
                       case 0x04:
                           freq = '928 Mhz';
                           break;
                       case 0x20:
                           freq = '2.4 Ghz';
                           break;
                   }

                   switch(telegram.data[2]){
                       case 0x00:
                           protocol = 'ERP1';
                           break;
                       case 0x01:
                           protocol = 'ERP2';
                           break;
                       case 0x10:
                           protocol = '802.15.4';
                           break;
                       case 0x20:
                           protocol = 'Bluetooth';
                           break;
                       case 0x30:
                           protocol = 'Long Range';
                           break;
                   }

                   adapter.extendObject('gateway', {
                       native: {
                           "Frequency":  freq,
                           "Protocol":  protocol
                       }});
           }



            break;
        case '33 0':       //Response for CO_RD_VERSION
            lastCMD.splice(0, 1);

            let appVerMain  = telegram.data[1];
            let appVerBeta = telegram.data[2];
            let appVerAlpha = telegram.data[3];
            let appVerBuild = telegram.data[4];
            let apiVerMain  = telegram.data[5];
            let apiVerBeta = telegram.data[6];
            let apiVerAlpha = telegram.data[7];
            let apiVerBuild = telegram.data[8];
            let chipID  = (telegram.data[9] + telegram.data[10] + telegram.data[11] + telegram.data[12]);
            let chipVer = (telegram.data[13] + telegram.data[14] + telegram.data[15] + telegram.data[16]);
            let appDescHex = [telegram.data[17] + telegram.data[18] + telegram.data[19] + telegram.data[20] + telegram.data[21] + telegram.data[22] + telegram.data[23] + telegram.data[24] + telegram.data[25] + telegram.data[26] + telegram.data[27] + telegram.data[28] + telegram.data[29] + telegram.data[30] + telegram.data[31] + telegram.data[32] + telegram.data[33]];


            adapter.log.debug('Return Code: ' + retCode + ' APP Version: ' + appVerMain + '.' + appVerBeta + '.' + appVerAlpha + '.' + appVerBuild + ' API Version: ' + apiVerMain + '.' + apiVerBeta + '.' + apiVerAlpha + '.' + apiVerBuild + ' Chip ID: ' + chipID + ' Chip Version: ' + chipVer + ' APP description: ' + appDescHex);
            adapter.extendObject('gateway', {
                native: {
                    "APP Version":  appVerMain + '.' + appVerBeta + '.' + appVerAlpha + '.' + appVerBuild,
                    "API Version":  apiVerMain + '.' + apiVerBeta + '.' + apiVerAlpha + '.' + apiVerBuild,
                    "Chip ID":      chipID,
                    "Chip Version": chipVer
                }});
            break;

    }
    console.log('Data length: ' + telegram.dataLength + ' Optional length:' + telegram.optionalLength);


}

/**
 * Parses a data package from the ESP3 serial interface
 * @param {Buffer} data The received data
 */
function parseMessage(data) {
    adapter.log.debug("Received raw message: " + data.toString("hex"));

    const packet = new ESP3Packet(data);

    adapter.log.debug("Packet type: " + packet.type);

    switch (packet.type) {
        case 1: // normal user data
            handleType1Message(packet);
            break;
        case 2:
            handleType2Message(packet);
            break;

        default:
            adapter.log.debug("Packet type " + toHex(packet.type) + " has been received, but is not handled.");
            break;
    }
}

// add a device
function addDevice(id, manufacturer, device, eep, description) {
    // check, if a EEP translation matrix is available
    let eepEntry = TRANSLATION_MATRIX[eep.toLowerCase()];

    if ((eepEntry != undefined) && (eepEntry.desc[description.toLowerCase()] != undefined)) {
        // create the object provided by the translation matrix
        let descEntry = eepEntry.desc[description.toLowerCase()];
        if(device === null){
            device = eepEntry.desc.native.devName;
        }
        adapter.setObjectNotExists(id, {
            type: 'device',
            common: {
                name: device + ' ' + manufacturer
            },
            native: {
                id: id,
                eep: [eep],
                manufacturer: manufacturer,
                device: device,
                desc: description
            }
        }, (err, _obj)=>{
            if(_obj === undefined) {
                adapter.getObject(id, (err, obj) => {
                    let oldEEP = obj.native.eep;
                    for (let i = 0; i < oldEEP.length; i++) {
                        let patt = new RegExp(eep);
                        let test = patt.test(oldEEP[i]);
                        if (test === false) {
                            oldEEP.push(eep.toUpperCase());
                            devices[id].eep = oldEEP;
                            adapter.extendObject(id, {native: {eep: oldEEP}});
                        }
                    }
                })

            }else{
                devices[id] = {
                    type: 'device',
                    common: {
                        name: device + ' ' + manufacturer
                    },
                    native: {
                        id: id,
                        eep: [eep],
                        manufacturer: manufacturer,
                        device: device,
                        desc: description
                    }
                };
            }
        });



        // all devices have this entry, which is provided by the gateway
        adapter.setObjectNotExists(id + '.rssi', {
            type: 'state',
            common: {
                name: 'Signal Strength',
                role: 'value.rssi',
                type: 'number',
                read: true,
                write: false
            },
            native: {}
        });

        let varObjects = descEntry.iobObjects;
        for (let variable in varObjects) {
            let entriesToCreate = descEntry.iobObjects[variable];
            adapter.setObjectNotExists(id + '.' + entriesToCreate['id'], {
                type: 'state',
                common: {
                    name: entriesToCreate['common.name'],
                    type: entriesToCreate['common.type'],
                    min: entriesToCreate['common.min'],
                    max: entriesToCreate['common.max'],
                    def: entriesToCreate['common.def'],
                    role: entriesToCreate['common.role'],
                    states: entriesToCreate['common.states'],
                    read: entriesToCreate['common.read'],
                    write: entriesToCreate['common.write'],
                    unit: entriesToCreate['common.unit']
                }, native: {}
            });

        }
    } else {
        adapter.log.warn('The EEP/description (' + eep + '/' + description + ') has not been found and is therefore not supported.');
    }
}

// delete a device
function deleteDevice(deviceId) {
    if (deviceId in devices) {
        adapter.log.debug(`deleting device and state ${deviceId}`);
        // delete all states
        adapter.getStatesOf(deviceId, (err, result) => {
            adapter.log.debug(`got all states of ${deviceId}. err=${JSON.stringify(err)}, result=${JSON.stringify(result)}`);
            if (result) {
                for (const state of result) {
                    adapter.log.debug(`deleting ${state._id}`);
                    adapter.delState(state._id, () => {
                        adapter.delObject(state._id);
                    })
                }
            }
            // and delete the device itself
            adapter.log.debug(`deleting ${deviceId}`);
            adapter.deleteDevice(deviceId);
        });
    }
}

// is called when databases are connected and adapter received configuration.
// start here!
function main() {
    // Sicherstellen, dass die instanceObjects aus io-package.json korrekt angelegt sind
    ensureInstanceObjects();


    // Eigene Objekte/States beobachten
    adapter.subscribeStates('*');
    adapter.subscribeObjects('*');

    // existierende Objekte einlesen
    adapter.getDevices((err, result) => {
        if (result) {
            for (const item in result) {
                const id = result[item]._id.substr(adapter.namespace.length + 1);
                devices[id] = result[item];
            }
        }
    });

    adapter.setState('info.connection', false, true);

    // get the list of available serial ports. Needed for win32 systems.
    sP.list(function (err, ports) {
        AVAILABLE_PORTS = ports.map(p => p.comName);
    });

    try {
        SERIAL_PORT = new sP(adapter.config.serialport, { baudRate: 57600, autoOpen: false });
        SERIALPORT_ESP3_PARSER = SERIAL_PORT.pipe(new SERIALPORT_PARSER_CLASS());
        SERIAL_PORT.open(function (err) {
            if (err) {
                throw new Error('Configured serial port is not available. Please check your Serialport setting and your USB Gateway.');
            }
        });

        // the open event will always be emitted
        SERIAL_PORT.on('open', function () {
            adapter.log.debug("Port has been opened.");
            adapter.setState('info.connection', true, true);
        });

        getGatewayInfo();


        //      SERIAL_PORT.on('data', function (data) {
        //        parseMessage(data);
        //      });

        SERIALPORT_ESP3_PARSER.on('data', function (data) {
            parseMessage(data);
        });


    } catch (e) {
        adapter.log.warn('Unable to connect to serial port. + ' + JSON.stringify(e));
    }

}

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', (callback) => {
    try {
        adapter.log.debug("Shutting down.");
        adapter.setState('info.connection', false, true);

        if (SERIAL_PORT !== null) {
            SERIAL_PORT.close();
        }
    } catch (e) {
    } finally {
        // callback has to be called under any circumstances!
        callback();
    }
});

// is called if a subscribed object changes
adapter.on('objectChange', (id, obj) => {

    if (id.startsWith(adapter.namespace)) {
        // this is our own object.

        if (obj) {
            // remember the object
            if (obj.type === 'device') {
                devices[id] = obj;
            }
        } else {
            // object deleted, forget it
            if (id in devices) delete devices[id];
        }
    }
});

// is called if a subscribed state changes
adapter.on('stateChange', (id, state) => {
    if (state && !state.ack && id.startsWith(adapter.namespace)) {
        console.log(id + ' ' + JSON.stringify(state));

    }
});

// Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
adapter.on('message', (obj) => {
    // responds to the adapter that sent the original message
    function respond(response) {
        if (obj.callback)
            adapter.sendTo(obj.from, obj.command, response, obj.callback);
    }
    // some predefined responses so we only have to define them once
    const predefinedResponses = {
        ACK: { error: null },
        OK: { error: null, result: 'ok' },
        ERROR_UNKNOWN_COMMAND: { error: 'Unknown command!' },
        ERROR_NOT_RUNNING: { error: 'EnOcean driver is not running!' },
        MISSING_PARAMETER: (paramName) => {
            return { error: `missing parameter "${paramName}"!` };
        },
        COMMAND_RUNNING: { error: 'command running' }
    };
    // make required parameters easier
    function requireParams(params) {
        if (!(params && params.length)) return true;
        for (const param of params) {
            if (!(obj.message && obj.message.hasOwnProperty(param))) {
                respond(predefinedResponses.MISSING_PARAMETER(param));
                return false;
            }
        }
        return true;
    }


    // handle the message
    if (obj) {
        let wait = false;
        let retVal = {};
        switch (obj.command) {
            case 'listSerial':
                // enumerate serial ports for admin interface
                try {
                    const ports = listSerial();
                    respond({ error: null, result: ports });
                } catch (e) {
                    respond({ error: e, result: ['Not available'] });
                }
                break;
            case 'delete':
                adapter.log.debug("Try to delete " + JSON.stringify(obj.message.deviceID));
                deleteDevice(obj.message.deviceID);
                break;
            case 'addDevice':
                adapter.log.debug("Try to add " + JSON.stringify(obj.message.deviceID));
                // Add checks here
                if(false){

                } else {
                    let eep = obj.message.eep;
                    let desc = obj.message.desc;
                    let manu = obj.message.manufacturer;
                    let device = obj.message.device;

                    // EEP/desc or manu/device
                    if (((eep === "") || (desc === "")) && (manu !== "" && device !== "")) {
                        adapter.log.debug("Selection by manufacturer and device : " + manu + " : " + device);
                        let x =  MANUFACTURER_LIST[manu][device].eep.length;
                        let i = x-1;
                        function loop(){
                            if(i >= 0){

                                eep = MANUFACTURER_LIST[manu][device].eep[i].val;
                                desc = MANUFACTURER_LIST[manu][device].eep[i].type;

                                adapter.log.debug("EEP : " + eep + " and desc : " + desc);
                                addDevice(obj.message.deviceID, manu, device, eep, desc);

                                i = i-1;
                                setTimeout(loop, 500)
                            }
                        }
                        loop();

                    }else{
                        adapter.log.debug("EEP : " + eep + " and desc : " + desc);
                        addDevice(obj.message.deviceID, manu, device, eep, desc);
                    }


                }
                break;
            case 'getManufacturerList':
                adapter.log.debug("Received getManufacturerList");
                for (let key in MANUFACTURER_LIST) {
                    if (MANUFACTURER_LIST.hasOwnProperty(key)) {
                        let manuDevice = MANUFACTURER_LIST[key];
                        let localDeviceList = {};
                        for (let oneDevice in manuDevice) {
                            localDeviceList[oneDevice] = { desc: manuDevice[oneDevice].desc };
                        }
                        retVal[key] = localDeviceList;
                    }
                }
                respond({ error: null, result: retVal });
                break;
            case 'getEEPList':
                adapter.log.debug("Received getEEPList");
                for (let key in TRANSLATION_MATRIX) {
                    if (TRANSLATION_MATRIX.hasOwnProperty(key)) {
                        let eepType = TRANSLATION_MATRIX[key];
                        let eepTypeEntries = {};
                        for (let oneEEPType in eepType.desc) {
                            eepTypeEntries[oneEEPType.toUpperCase()] = { desc: oneEEPType.toUpperCase() };
                        }
                        retVal[key] = eepTypeEntries;
                    }
                }
                //                  adapter.log.debug("EEP List : " + JSON.stringify(retVal));
                respond({ error: null, result: retVal });
                break;
            case 'setTeachin':
                adapter.log.info('Teachin: ' + obj.message);
                teachin = obj.message;
                if(obj.callback) adapter.sendTo(obj.from, obj.command, 'done', obj.callback);
                setTimeout(()=>{
                    teachin = false;
                    adapter.log.info('Teachin: false');
                }, adapter.config.teachinTime * 1000);
                wait = true;
                break;

            default:
                adapter.log.info("Received unhandled message: " + obj.command);
                break;
        }
    }
});


// filter serial deviceesfunction filterSerialPorts(path) {
function filterSerialPorts(path) {
    // get only serial port names
    if (!(/(tty(ACM|USB|AMA|MFD|Enocean|enocean|EnOcean|\.usbserial-)|rfcomm)/).test(path)) return false;

    return fs
        .statSync(path)
        .isCharacterDevice();
}

// list serial ports
function listSerial() {
    let result;

    if (PLATFORM === 'linux' || PLATFORM === 'darwin') {
        // Filter out the devices that aren't serial ports
        const devDirName = '/dev';

        let ports;
        try {
            ports = fs
                .readdirSync(devDirName)
                .map(function (file) {
                    return path.join(devDirName, file);
                })
                .filter(filterSerialPorts)
                .map(function (port) {
                    return { comName: port };
                });
        } catch (e) {
            adapter.log.error('Cannot read "' + devDirName + '": ' + e);
            ports = [];
        }
        result = ports.map(p => p.comName);
    } else if (PLATFORM === 'win32') {
        result = AVAILABLE_PORTS;
    }

    return result;
}

// Workaround für unvollständige Adapter-Upgrades
function ensureInstanceObjects() {
    // read io-package.json
    const ioPack = JSON.parse(
        fs.readFileSync(path.join(__dirname, 'io-package.json'), 'utf8')
    );

    if (ioPack.instanceObjects === null || ioPack.instanceObjects.length === 0) return;

    // make sure all instance objects exist
    for (const obj of ioPack.instanceObjects) {
        adapter.setObjectNotExists(obj._id, obj, (err) => {
            // and set their default value
            // racing condition: setting the default value might lead to a wrong adapter state.
            //            if (!err && obj.common && obj.common.def !== null && obj.common.def !== undefined) {
            //                adapter.setState(obj._id, obj.common.def, true);
            //            }
        });
    }
}

function getGatewayInfo(){
    let header = Buffer.from([0x00, 0x01,0x00, 0x05]);
    let data;


    //CO_RD_VERSION
    data = Buffer.from([0x03]);
    sendCMDtoGateway(header, data);
    lastCMD.push(0x03);

    //CO_RD_REPEATER
    data = Buffer.from([0x0A]);
    sendCMDtoGateway(header, data);
    lastCMD.push(0x0A);


    //CO_GET_FREQUENCY_INFO
        data = Buffer.from([0x25]);
        sendCMDtoGateway(header, data);
        lastCMD.push(0x25);



}


function sendCMDtoGateway(header, data){
    const sync = Buffer.from([0x55]);
    let crc8h = Buffer.from([crc8.calcCrc8(header)]);
    let crc8d = Buffer.from([crc8.calcCrc8(data)]);

    SERIAL_PORT.write(Buffer.concat([sync, header, crc8h, data, crc8d]), (err) => {
        if(err){
            console.log('Error: ' + err)
        }
    });
}

function returnResponse(code){
    const text = {  0: "RET_OK",
                    1: "RET_ERROR",
                    2: "RET_NOT_SUPPORTED",
                    3: "RET_WRONG_PARAM",
                    4: "RET_OPERATION_DENIED",
                    5: "RET_LOCK_SET",
                    6: "RET_BUFFER_TO_SMALL",
                    7: "RET_NO_FREE_BUFFER"
                };
    return(text[code]);
}

function returnPacketType(cmd){
    const types = {
        0x01: "RADIO_ERP1",
        0x02: "RESPONSE",
        0x03: "RADIO_SUB_TEL",
        0x04: "EVENT",
        0x05: "COMMON_COMMAND",
        0x06: "SMART_ACK_COMMAND",
        0x07: "REMOTE_MAN_COMMAND",
        0x09: "RADIO_MESSAGE",
        0x0A: "RADIO_ERP2",
        0x10: "RADIO_805_15_4",
        0x11: "COMMAND_2_4"
    };
    return(types[cmd]);
}

function returnEvent(event){
    const events = {
        1: "SA_RECLAIM_NOT_SUCCESSFUL",
        2: "SA_CONFIRM_LEARN",
        3: "SA_LEARN_ACK",
        4: "CO_READY",
        5: "CO_EVENTS_SECUREDEVICES",
        6: "CO_DUTYCYCLE_LIMIT",
        7: "CO_TRANSMIT_FAILED"
    };
    return(events[event]);
}

function returnCommonCMD(cmd){
    const cCmds = {
        1: "CO_WR_SLEEP",
        2: "CO_WR_RESET",
        3: "CO_RD_VERSION",
        4: "CO_RD_SYS_LOG",
        5: "CO_WR_SYS_LOG",
        6: "CO_WR_BIST",
        7: "CO_WR_IDBASE",
        8: "CO_RD_IDBASE",
        9: "CO_WR_REÜEATER",
        10: "CO_RD_REPEATER",
        11: "CO_WR_FILTER_ADD",
        12: "CO_WR_FILTER_DEL",
        13: "CO_WR_FILTER_DEL_ALL",
        14: "CO_WR_FILTER_ENABLE",
        15: "CO_RD_FILTER",
        16: "CO_WR_WAIT_MATURITY",
        17: "CO_WR_SUBTEL",
        18: "CO_WR_MEM",
        19: "CO_RD_MEM",
        20: "CO_RD_MEM_ADDRESS",
        21: "CO_RD_SECURITY",
        22: "CO_WR_SECURITY",
        23: "CO_WR_LEARNMODE",
        24: "CO_RD_LEARNMODE",
        25: "CO_WR_SECUREDEVICE_ADD",
        26: "CO_WR_SECUREDEVICE_DEL",
        27: "CO_RD_SECUREDEVICE_BY_INDEX",
        28: "CO_WR_MODE",
        29: "CO_RD_NUMSECUREDEVICES",
        30: "COR_RD_SECUREDEVICE_BY_ID",
        31: "CO_WR_SECUREDEVICE_ADD_PSK",
        32: "CO_WR_SECUREDEVICE_SENDTEACHIN",
        33: "CO_WR_TEMPORARY_RLC_WINDOW",
        34: "CO_RD_SECUREDEVICE_PSK",
        35: "CO_RD_DUTYCYCLE_LIMIT",
        36: "CO_SET_BAUDRATE",
        37: "CO_GET_FREQUENCY_INFO",

        39: "CO_GET_STEPCODE",

        46: "CO_WR_REMAN_CODE",
        47: "CO_WR_STARTUP_DELAY",
        48: "CO_WR_REMAN_REPEATING",
        49: "CO_RD_REMAN_REPEATING",
        50: "CO_SET_NOISTHRESHOLD",
        51: "CO_GET_NOISETHRESHOLD"
    };
    return(cCmds[cmd]);
}

