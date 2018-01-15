/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

// you have to require the utils module and call adapter function
const utils = require(__dirname + '/lib/utils'); // Get common adapter utils

const eo = require('node-enocean')();
const sP = require('serialport');
const os = require('os');
const path = require('path');
const fs = require('fs');

const platform = os.platform();

// dictionary (id => obj) of all known devices
const devices = {};

// translation matrix
const translationMatrix = require('./eep/EEP2IOB.json');

// translation functions
var eepTranslation = require('./eep/eepInclude.js');

// list of manufacturers, devicees and their configuration
const manufacturerList = require("./eep/devices.json");

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
const adapter = utils.Adapter({
    name: 'enocean',
    ready: main,
});

// is called when databases are connected and adapter received configuration.
// start here!
async function main() {
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

    // EnOcean-Treiber starten
    adapter.setState('info.connection', false, true);
    //Check if configured port exists and start listening
    try {
        const availablePorts = await listSerial();
        if (availablePorts.indexOf(adapter.config.serialport) > -1) {
            adapter.log.debug('Found Serialport and start listening on ' + adapter.config.serialport.toString());
            eo.listen(adapter.config.serialport);
        } else {
            throw new Error('Configured serial port is not available. Please check your Serialport setting and your USB Gateway.');
        }
    } catch (e) {
        adapter.log.error(e);
    }
}

eo.on('ready', (/* data */) => {
    adapter.setState('info.connection', true, true);

    // set timeout from config
    eo.timeout = adapter.config.timeout; // seconds
});


// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', (callback) => {
    try {
        adapter.setState('info.connection', false, true);
        // End driver
        eo.close();
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
        // our own state was changed from within ioBroker, react to it
        if (id.endsWith('.learnMode')) {
            if (learnMode === 'learning' && state.val !== 1 /* learning */) {
                stopLearning();
            } else if (learnMode === 'forgetting' && state.val !== 2 /* forgetting */) {
                stopForgetting();
            }

            if (learnMode !== 'learning' && state.val === 1 /* learning */) {
                startLearning();
            } else if (learnMode !== 'forgetting' && state.val === 2 /* forgetting */) {
                startForgetting();
            }
        }
    }
});

// Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
adapter.on('message', async (obj) => {

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
        switch (obj.command) {
            case 'listSerial':
                // enumerate serial ports for admin interface
                try {
                    const ports = await listSerial();
                    respond({ error: null, result: ports });
                } catch (e) {
                    respond({ error: e, result: ['Not available'] });
                }
                break;
            case 'delete':
                adapter.log.debug("Try to delete " + JSON.stringify(obj.message.deviceID));
                eo.forget(obj.message.deviceID);
                break;
            case 'addDevice':
              adapter.log.debug("Try to add " + JSON.stringify(obj.message.deviceID));
                var eep = obj.message.eep ;
                var desc = obj.message.desc;
                var manu = obj.message.manufacturer;
                var device = obj.message.device;

                // EEP/desc or manu/device
                if ( ((eep === "") || (desc === "")) && (manu !== "" && device !== "")) {
                  adapter.log.debug("Selection by manufacturer and device : " + manu + " : " + device);
                  eep = manufacturerList[manu][device].eep[0].val;
                  desc = manufacturerList[manu][device].eep[0].type;
                }

                adapter.log.debug("EEP : " + eep + " and desc : " + desc);

                eo.learn({
                    id: obj.message.deviceID,
                    eep: eep,
                    desc: desc,
                    manufacturer: manu,
                    eepFunc: device
                });
                break;
              case 'getManufacturerList' :
                adapter.log.debug("Received getManufacturerList");
                var retVal = {};
                for (var key in manufacturerList) {
                  if (manufacturerList.hasOwnProperty(key)) {
                    var manuDevice = manufacturerList[key];
                    for (var oneDevice in manuDevice) {
                      retVal[key] = { [oneDevice] : { desc : manuDevice[oneDevice].desc}};
                    }
                  }
                }
                respond({ error: null, result: retVal });
                break;
            default:
                adapter.log.info("Received unhandled message: " + obj.command);
                break;
        }
    }

});

// ===============================
// Manage learning modes
let learnMode = 'idle'; // default to not learning
function startLearning() {
    adapter.log.info(`Learn mode activated for ${adapter.config.timeout} seconds`);
    learnMode = 'learning';
    adapter.setState('info.learnMode', 1 /* learning */, true);
    eo.startLearning();
}

function stopLearning() {
    learnMode = 'idle';
    adapter.setState('info.learnMode', 0 /* idle */, true);
    eo.stopLearning();
}

function startForgetting() {
    adapter.log.info(`Forget mode activated for ${adapter.config.timeout} seconds`);
    learnMode = 'forgetting';
    adapter.setState('info.learnMode', 2 /* forgetting */, true);
    eo.startForgetting();
}

function stopForgetting() {
    learnMode = 'idle';
    adapter.setState('info.learnMode', 0 /* idle */, true);
    eo.stopForgetting();
}

// gets called when the learn mode ends
eo.on('learn-mode-stop', (obj) => {
    adapter.log.info('Learn mode deactivated');
    learnMode = 'idle';
    adapter.setState('info.learnMode', 0 /* idle */, true);
});

// gets called when the forget mode ends
eo.on('forget-mode-stop', (obj) => {
    adapter.log.info('Forget mode deactivated');
    learnMode = 'idle';
    adapter.setState('info.learnMode', 0 /* idle */, true);
});

// gets called when a new device is registered
eo.on('learned', (data) => {
    adapter.log.info('New device registered: ' + JSON.stringify(data));

    // check, if a EEP translation matrix is available
    var eepEntry = translationMatrix[data['eep'].toLowerCase()];

    if ((eepEntry != undefined) && (eepEntry.desc[data['desc'].toLowerCase()] != undefined)){
        // create the object provided by the translation matrix
        var descEntry = eepEntry.desc[data['desc'].toLowerCase()];

 //       if (descEntry != undefined) {
            // a valid entry has been found
            var eepType = eo.eepDesc[data['eep'].toLowerCase()];

            adapter.setObjectNotExists(data['id'], {
                type: 'device',
                common: {
                    name: data['id']
                },
                native: {
                    id: data['id'],
                    eep: data['eep'],
                    manufacturer: data['manufacturer'],
                    device:  data['eepFunc'],
                    desc: data['desc']
                }
            });

            // all devices have this entry, which is provided by the gateway
            adapter.setObjectNotExists(data['id'] + '.rssi', {
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

            var varObjects = descEntry.iobObjects;
            for (var variable in varObjects) {
                var entriesToCreate = descEntry.iobObjects[variable];
                adapter.setObjectNotExists(data['id'] + '.' + entriesToCreate['id'], {
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
                        write: entriesToCreate['common.write']
                    }, native: {}
                });

            }

            devices[data['id']] = data;

        //} else {
        //    // The description hasn't been found. This should not happen and a warning has to be issued.
        //    adapter.log.warn('The EEP has been found, but the description [' + data['desc'] + '] has not.');
        //}
    } else {
        // use the values provided by the enocean library.
        adapter.setObjectNotExists(data['id'], {
            type: 'device',
            common: {
                name: data['id']
            },
            native: {
                id: data['id'],
                eep: data['eep'],
                manufacturer: data['manufacturer'],
                desc: data['desc'],
                eepType: eepType
            }
        });

        // all devices have this entry, which is provided by the gateway
        adapter.setObjectNotExists(data['id'] + '.rssi', {
            type: 'state',
            common: {
                name: 'Signal Strength',
                role: 'value.rssi',
                type: 'number'
            },
            native: {}
        });

        devices[data['id']] = data;

        // TODO: get additional data from the EnOcean library to create the states.
        // At the moment the object shall be created at the moment the data comes in.
    }
});

// gets called when a device is forgotten
eo.on('forgotten', (data) => {
    // delete the device in ioBroker
    const deviceId = data.id;
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
    adapter.log.info('Device forgotten: ' + JSON.stringify(data));
});

// ===============================

eo.on('known-data', (data) => {
    adapter.log.debug('Recived data that are known: ' + JSON.stringify(data));
    const senderID = data['senderId'];
    const rssi     = data['rssi'];
    const sensor   = data['sensor'];
    // var nrOfValues = data['values'].length;
    // var nrOfData = data['sensor'].length;

    if (senderID in devices) {
        adapter.setState(senderID + '.rssi', { val: rssi, ack: true });

        var eepEntry = sensor['eep'].toLowerCase().replace(/-/g,"_") + '_' + sensor['desc'].toLowerCase();
        var callFunction = eepTranslation[eepEntry];

        if (callFunction != undefined) {
            // The return value is a map consisting of variable and value

            var varToSet = callFunction(data['rawByte'].slice(12,100));
            for (var key in varToSet) {
                adapter.log.debug("Set :"  + key + " to value : " + varToSet[key]);
                adapter.setState(senderID + '.' + key, { val: varToSet[key], ack: true });
            }


        } else {
            //write values transmitted by device
            if (data.values) {
                for (const telegramValue of data.values) {
                    // extract the info
                    let {
                type: name = 'unknown',
                        unit = '',
                        value: varValue
            } = telegramValue;
                    name = name.replace(/\s/g, '_');

                    // ignore unknown values
                    if (name === 'unknown' && varValue === 'unknown' && unit === 'unknown') continue;

                    adapter.setObjectNotExists(senderID + '.' + name, {
                        type: 'state',
                        common: {
                            name: name,
                            role: 'value',
                            type: 'mixed',
                            unit: unit
                        },
                        native: {}
                    });
                    adapter.setState(senderID + '.' + name, { val: varValue, ack: true });
                }
            }
            //write data transmitted by device
            if (data.data) {
                for (const key of Object.keys(data.data)) {
                    // extract the info
                    let {
                name = 'unknown',
                        unit = '',
                        desc = '',
                        value: varValue
            } = data.data[key];
                    name = name.replace(/\s/g, '_');

                    adapter.setObjectNotExists(senderID + '.' + key, {
                        type: 'state',
                        common: {
                            name: name,
                            role: 'value',
                            type: 'mixed',
                            unit: unit,
                            desc: desc
                        },
                        native: {}
                    });
                    adapter.setState(senderID + '.' + key, { val: varValue, ack: true });
                }
            } else {
                // MSC telegrams have no data attribute
                let {
            manufacturerid: manufacturerID,
                    packetTypeString: packetType,
                    raw: varValue
        } = data;
                const objNative = { manufacturerID, packetType };
                const objId = `${senderID}.raw`;
                // also store some additional info about the packet, so try to get the object
                adapter.getObject(objId, (obj) => {
                    if (!obj || JSON.stringify(obj.native) !== JSON.stringify(objNative)) {
                        // set or update the object
                        adapter.setObject(objId, {
                            type: 'state',
                            common: {
                                name: 'raw telegram',
                                role: 'value',
                                type: 'string'
                            },
                            native: objNative
                        });
                    }
                    adapter.setState(objId, { val: varValue, ack: true });
                });
            }
        }
    } else {
        adapter.log.warn("Received unknow device information. Data will be ignored.");
    }
});

async function listSerial() {

    return new Promise((resolve, reject) => {
        sP.list((err, ports) => {
            if (err) {
                reject(`could not enumerate serial ports: ${err}`);
            } else {
                if (!ports || ports.length === 0) {
                    reject('No device found: Please check your Serialport setting and your gateway');
                    return;
                }

                // extract the port names
                let result = ports.map(p => p.comName);
                // on linux filter the ports by type
                if (platform === 'linux') {
                    // device can be a USB stick (ttyUSBx) or EnoceanPi gpio header (ttyAMAx)
                    //result = result.filter(p => p.match(/tty(USB|AMA)/g));
                    result = result.filter(p => p.match(/ttyUSB/g));  // new style: symlinks should be selectable.
                }

                resolve(result);
            }
        });
    });

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
            if (!err && obj.common && obj.common.def !== null && obj.common.def !== undefined) {
                adapter.setState(obj._id, obj.common.def, true);
            }
        });
    }
}
