/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils

const eo = require("node-enocean")();
const sP = require("serialport");
const os = require("os");
const path = require("path");
const fs = require("fs");

const platform = os.platform();

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
const adapter = utils.adapter({
    name: 'enocean',
    ready: main,
});

// is called when databases are connected and adapter received configuration.
// start here!
async function main() {
    // Sicherstellen, dass die instanceObjects aus io-package.json korrekt angelegt sind
    ensureInstanceObjects();

    // Eigene Objekte/States beobachten
    adapter.subscribeStates("*");
    adapter.subscribeObjects("*");    

    // EnOcean-Treiber starten
    adapter.setState("info.connection", false, true);
    //Check if configured port exists and start listening
    try {
        const availablePorts = await listSerial();
        if (availablePorts.indexOf(adapter.config.serialport) > -1) {
            adapter.log.debug('Found Serialport and start listening');
            eo.listen(adapter.config.serialport);
        } else {
            throw new Error("Configured serial port is not available. Please check your Serialport setting and your USB Gateway.");            
        }
    } catch (e) {
        adapter.log.error(e);
    }
}

eo.on("ready", (data) => {
    adapter.setState("info.connection", true, true);

    // set timeout from config
    eo.timeout = adapter.config.timeout; // seconds
});
    
    
// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', (callback) => {
    try {
        adapter.setState("info.connection", false, true);
        // Treiber beenden
        eo.close();
    } catch (e) {
    } finally {
        // callback has to be called under any circumstances!
        callback();
    }
});

// is called if a subscribed object changes
adapter.on('objectChange', (id, obj) => {
    // Warning, obj can be null if it was deleted
    // adapter.log.debug('objectChange ' + id + ' ' + JSON.stringify(obj));
});

// is called if a subscribed state changes
adapter.on('stateChange', (id, state) => {
    if (state && !state.ack && id.startsWith(adapter.namespace)) {
        // our own state was changed from within ioBroker, react to it
        if (id.endsWith(".learnMode")) {
            if (learnMode === "learning" && state.val !== 1 /* learning */) {
                stopLearning();
            } else if (learnMode === "forgetting" && state.val !== 2 /* forgetting */) {
                stopForgetting();
            }

            if (learnMode !== "learning" && state.val === 1 /* learning */) {
                startLearning();
            } else if (learnMode !== "forgetting" && state.val === 2 /* forgetting */) {
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
    var predefinedResponses = {
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
            case "listSerial":
                // enumerate serial ports for admin interface
                try {
                    const ports = await listSerial();
                    respond({ error: null, result: ports });
                } catch (e) {
                    respond({ error: e, result: ['Not available'] });
                }
                break;
        }
    }

});

// ===============================
// Manage learning modes
let learnMode = "idle"; // default to not learning
function startLearning() {
    adapter.log.debug(`Learn mode activated for ${adapter.config.timeout} seconds`);
    learnMode = "learning";
    adapter.setState("learnMode", 1 /* learning */, true);
    eo.startLearning();
}

function stopLearning() {
    learnMode = "idle";
    adapter.setState("learnMode", 0 /* idle */, true);
    eo.stopLearning();
}

function startForgetting() {
    adapter.log.debug(`Forget mode activated for ${adapter.config.timeout} seconds`);
    learnMode = "forgetting";
    adapter.setState("learnMode", 2 /* forgetting */, true);
    eo.startForgetting();
}

function stopForgetting() {
    learnMode = "idle";
    adapter.setState("learnMode", 0 /* idle */, true);
    eo.stopForgetting();
}

// gets called when the learn mode ends
eo.on("learn-mode-stop", (obj) => {
    adapter.log.info('Teach mode deactivated');
    learnMode = "idle";
    adapter.setState("learnMode", 0 /* idle */, true);
});

// gets called when the forget mode ends
eo.on("forget-mode-stop", (obj) => {
    adapter.log.info('Forget mode deactivated');
    learnMode = "idle";
    adapter.setState("learnMode", 0 /* idle */, true);
});

// gets called when a new device is registered
eo.on("learned", (data) => {
    adapter.log.info('New device registered: ' + JSON.stringify(data));
    // TODO: create device states (?)
});

// gets called when a new device is registered
eo.on("forgotten", (data) => {
    adapter.log.info('Device forgotten: ' + JSON.stringify(data));
    // TODO: delete device states (?)
});

// ===============================

eo.on("known-data", (data) => {
    adapter.log.debug('Recived data that are known: ' + JSON.stringify(data));
    var senderID = data['senderId'];
    var rssi = data['rssi'];
    var sensor = data['sensor'];
    var nrOfValues = data['values'].length;
    var nrOfData = data['sensor'].length;


    adapter.setObjectNotExists(senderID, {
        type: 'device',
        common: {
            name: senderID
        },
        native: sensor
    });

    adapter.setObjectNotExists(senderID + '.rssi', {
        type: 'state',
        common: {
            name: senderID + ' rssi',
            role: 'value.rssi',
            type: 'number'
        },
        native: {}
    });

    adapter.setState(senderID + '.rssi', {val: rssi, ack: true});
    
    //write values transmitted by device
    for (nrOfValues = nrOfValues - 1; nrOfValues >= 0; nrOfValues--) {
        var name = data['values'][nrOfValues]['type'];
        var patt = new RegExp(/\s/g);
        name = name.replace(patt, '_');
        var varValue = data['values'][nrOfValues]['value'];

        //adapter.log.debug('Value: ' + data['values'][nrOfValues]['value']);

        adapter.setObjectNotExists(senderID + '.' + name, {
            type: 'state',
            common: {
                name: name,
                role: 'value',
                type: 'mixed',
                unit: data['values'][nrOfValues]['unit']
            },
            native: {}
        });
        adapter.setState(senderID + '.' + name, {val: varValue, ack: true});
    }

    //write data transmitted by device
    Object.keys(data['data']).forEach(function (k) {
        //adapter.log.info(k + ' - ' + data['data'][k]);
        var key = k;
        var name = data['data'][k]['name'];
        var patt = new RegExp(/\s/g);
        name = name.replace(patt, '_');
        var unit = "";
        var desc = "";
        try {
            unit = data['data'][k]['unit'];
        } catch (err) {
        }
        try {
            desc = data['data'][k]['desc'];
        } catch (err) {
        }
        var varValue = data['data'][k]['value'];

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
        adapter.setState(senderID + '.' + key, {val: varValue, ack: true});
    });
});

async function listSerial() {

    return new Promise((resolve, reject) => {
        sP.list((err, ports) => {
            if (err) {
                reject(`could not enumerate serial ports: ${err}`);
                return;
            } else {
                if (ports == null || ports.length === 0) {
                    reject('No device found: Please check your Serialport setting and your gateway');
                    return;
                }
    
                // extract the port names
                let result = ports.map(p => p.comName);
                // on linux filter the ports by type
                if (platform === 'linux') {
                    // device can be a USB stick (ttyUSBx) or EnoceanPi gpio header (ttyAMAx)
                    result = result.filter(p => p.match(/tty(USB|AMA)/g));
                }
    
                resolve(result);
                return;
            }
        });
    });

}

// Workaround für unvollständige Adapter-Upgrades
function ensureInstanceObjects() {
    // read io-package.json
    const ioPack = JSON.parse(
        fs.readFileSync(path.join(__dirname, "io-package.json"), "utf8"),
    );

    if (ioPack.instanceObjects == null || ioPack.instanceObjects.length === 0) return;

    // make sure all instance objects exist
    for (const obj of ioPack.instanceObjects) {
        adapter.setObjectNotExists(obj._id, obj);
    }
}
