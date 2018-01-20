/* jshint -W097 */
// jshint strict:false
/*jslint node: true */
/*jslint es6 */
'use strict';

// you have to require the utils module and call adapter function
const utils = require(__dirname + '/lib/utils'); // Get common adapter utils

const sP = require('serialport');
const os = require('os');
const path = require('path');
const fs = require('fs');
const ENOCEAN_PARSER = require("serialport-enocean-parser");

const PLATFORM = os.platform();

// dictionary (id => obj) of all known devices
const devices = {};

// translation matrix
const TRANSLATION_MATRIX = require('./eep/EEP2IOB.json');

// translation functions
const EEP_TRANSLATION = require('./eep/eepInclude.js');

// list of manufacturers, devicees and their configuration
const MANUFACTURER_LIST = require("./eep/devices.json");

// list of available serial ports
var AVAILABLE_PORTS = {};

// The serial port
var SERIAL_PORT = null;

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
const adapter = utils.Adapter({
    name: 'enocean',
    ready: main
});

// convert byte to hex
function toHex(byte) {
  return ('0' + (byte & 0xFF).toString(16)).slice(-2);
}

// byte array to hex
function toHexString(byteArray) {
  var s = '';
  byteArray.forEach(function(byte) {
    s += toHex(byte);
  });
  return s;
}

// handle packet type 1 messages
function handleType1Message(data, rawMessage) {
  var senderID = rawMessage.slice(10 + ((data.header.dataLength - 5) * 2), 10 + ((data.header.dataLength - 1) * 2));
    // ID is 4 bytes long and at the end of the data plus on status byte.
  adapter.log.debug("Message for ID " + senderID + " has been received.");
  if (senderID in devices) {  // device is known
    if (data.header.optionalLength > 0) { // optional data including rssi are present
      adapter.setState(senderID + '.rssi', { val: data.optionalData[5], ack: true });
    }

    let eep = devices[senderID].native.eep;
    let description = devices[senderID].native.desc;

    let eepEntry = eep.toLowerCase().replace(/-/g,"_") + '_' + description.toLowerCase();
    let callFunction = EEP_TRANSLATION[eepEntry];

    if (callFunction != undefined) {
      // The return value is a map consisting of variable and value
      var varToSet = callFunction(rawMessage.slice(10,100));
      for (var key in varToSet) {
        adapter.setState(senderID + '.' + key, { val: varToSet[key], ack: true });
      }
    }
  }
}

// parse the datapackage and construct a raw message
function parseMessage(data) {

  // convert the databuffer to hex for easy parsing and debugging
  var rawMessage = toHex(data.syncByte) + toHex(data.header.dataLength) + toHex(data.header.optionalLength) + toHex(data.header.packetType);
  rawMessage += toHex(data.crc8Header);

  if (data.header.dataLength > 0) {
      rawMessage += toHexString(data.data);
  }
  if (data.header.optionalLength > 0) {
      rawMessage += toHexString(data.optionalData);
  }

  adapter.log.debug("Received raw message: " + rawMessage);

  // packet type 1
  switch (data.header.packetType) {
    case 1 : // normal user data
      handleType1Message(data, rawMessage);
      break;

    default:
      adapter.log.debug("Packet type " + toHex(data.header.packetType) + " has been received, but is not handled.");
  }
}

// add a device
function addDevice(id, manufacturer, device, eep, description) {
  // check, if a EEP translation matrix is available
  var eepEntry = TRANSLATION_MATRIX[eep.toLowerCase()];

  if ((eepEntry != undefined) && (eepEntry.desc[description.toLowerCase()] != undefined)){
      // create the object provided by the translation matrix
      var descEntry = eepEntry.desc[description.toLowerCase()];

      adapter.setObjectNotExists(id, {
          type: 'device',
          common: {
              name: id
          },
          native: {
              id: id,
              eep: eep,
              manufacturer: manufacturer,
              device:  device,
              desc: description
          }
      });

      devices[id] = {
          type: 'device',
          common: {
              name: id
          },
          native: {
              id: id,
              eep: eep,
              manufacturer: manufacturer,
              device:  device,
              desc: description
          }
        };

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

          var varObjects = descEntry.iobObjects;
          for (var variable in varObjects) {
              var entriesToCreate = descEntry.iobObjects[variable];
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
      SERIAL_PORT = new sP(adapter.config.serialport, { baudrate: 57600, autoOpen: false, parser: ENOCEAN_PARSER });
      SERIAL_PORT.open(function (err) {
        if (err) {
          throw new Error('Configured serial port is not available. Please check your Serialport setting and your USB Gateway.');
        }
      });

      // the open event will always be emitted
      SERIAL_PORT.on('open', function() {
        adapter.log.debug("Port has been opened.");
        adapter.setState('info.connection', true, true);
      });

      SERIAL_PORT.on('data', function (data) {
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

        if (SERIAL_PORT != null) {
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
                if (false) {

                } else {
                  var eep = obj.message.eep ;
                  var desc = obj.message.desc;
                  var manu = obj.message.manufacturer;
                  var device = obj.message.device;

                  // EEP/desc or manu/device
                  if ( ((eep === "") || (desc === "")) && (manu !== "" && device !== "")) {
                    adapter.log.debug("Selection by manufacturer and device : " + manu + " : " + device);
                    eep = MANUFACTURER_LIST[manu][device].eep[0].val;
                    desc = MANUFACTURER_LIST[manu][device].eep[0].type;
                  }

                  adapter.log.debug("EEP : " + eep + " and desc : " + desc);
                  addDevice(obj.message.deviceID,manu,device,eep,desc);
                }
                break;
              case 'getManufacturerList' :
                adapter.log.debug("Received getManufacturerList");
                var retVal = {};
                for (var key in MANUFACTURER_LIST) {
                  if (MANUFACTURER_LIST.hasOwnProperty(key)) {
                    var manuDevice = MANUFACTURER_LIST[key];
                    var localDeviceList = {};
                    for (var oneDevice in manuDevice) {
                      localDeviceList[oneDevice] = { desc: manuDevice[oneDevice].desc};
                    }
                    retVal[key] = localDeviceList;
                  }
                }
                respond({ error: null, result: retVal });
                break;
                case 'getEEPList' :
                  adapter.log.debug("Received getEEPList");
                  var retVal = {};
                  for (var key in TRANSLATION_MATRIX) {
                    if (TRANSLATION_MATRIX.hasOwnProperty(key)) {
                      var eepType = TRANSLATION_MATRIX[key];
                      var eepTypeEntries = {};
                      for (var oneEEPType in eepType.desc) {
                        eepTypeEntries[oneEEPType.toUpperCase()] = { desc: oneEEPType.toUpperCase()};
                      }
                      retVal[key] = eepTypeEntries;
                    }
                  }
//                  adapter.log.debug("EEP List : " + JSON.stringify(retVal));
                  respond({ error: null, result: retVal });
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
    if (!(/(tty(ACM|USB|AMA|MFD|Enocean|enocean|EnOcean)|rfcomm)/).test(path)) return false;

    return fs
        .statSync(path)
        .isCharacterDevice();
}

// list serial ports
function listSerial() {
  var result;

  if (PLATFORM === 'linux') {
    // Filter out the devices that aren't serial ports
    var devDirName = '/dev';

    var ports;
    try {
        ports = fs
            .readdirSync(devDirName)
            .map(function (file) {
                return path.join(devDirName, file);
            })
            .filter(filterSerialPorts)
            .map(function (port) {
                return {comName: port};
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
