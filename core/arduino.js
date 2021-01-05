/*
* arduino.js by Aaron Becker
* Arduino driver to communicate with external arduino, using protocol and command buffering
*
* Dedicated to Marc Perkel
*
* Copyright (C) 2018, Aaron Becker <aaron.becker.developer@gmail.com>
*/

const serialPort = require('serialport'); //require serialport driver
const deviceCommandQueue = require('./deviceCommandQueue.js');

var arduinoUtilities = {
    debugMode: false,
    arduinoCommandSplitChar: ";",
    arduinoCommandValueChar: "|",
    commandQueue: undefined,

    arduinoCommandBuffer: "",  //need buffer because might not recieve whole command in one recieve

    arduinoObject: undefined,
    extSettings: {},
    extInformation: {},

    existenceCheckPresent: false,
    arduinoConnected: false,

    init: function(eRuntimeSettings, eRuntimeInformation) {
        return new Promise((resolve, reject) => {
            if (typeof eRuntimeSettings == "undefined") {
                return reject("[ARDUINO] runtimeSettings undefined on init");
            } else {
                arduinoUtilities.extSettings = eRuntimeSettings;
            }
            if (typeof eRuntimeInformation == "undefined") {
                return reject("[ARDUINO] runtimeInformation undefined on init");
            } else {
                arduinoUtilities.extInformation = eRuntimeInformation;
            }

            //Create the command queue
            arduinoUtilities.commandQueue = new deviceCommandQueue("ArduinoQueue", eRuntimeSettings.arduinoCommandTimeout, false, arduinoUtilities.debugMode);
            return resolve(); //if it wasn't rejected then it's ok
        });
    },

    findArduino: function() {
        return new Promise((resolve, reject) => {
            var portsList = [];

            serialPort.list().then( ports => {
                ports.forEach((port) => {
                    portsList.push(port.path);
                });

                var testPortN = portNum => { //test port at number n of portsList
                    let curPortID = portsList[portNum];
                    try {
                        let curPort = new serialPort(curPortID, {
                            baudRate: arduinoUtilities.extSettings.arduinoBaudRate,
                            autoOpen: false //don't open it yet
                        });
                        curPort.open(function (err) {
                            if (err) {
                                portFailed(portNum, curPortID, "OPENING_FAIL");
                            } else {
                                //Step 1: Set max data time recv timeout
                                let dataRecvTimeout = setTimeout(() => {
                                    curPort.close();
                                    clearInterval(startCmdSendInterval); //remove data send interval
                                    portFailed(portNum, curPortID, "DATA_RECV_TIMEOUT");
                                }, arduinoUtilities.extSettings.portCheckDataTimeout);

                                //Step 2: Start sending existence check commands every 100ms
                                let startCmdSendInterval = setInterval(() => {
                                    curPort.write(arduinoUtilities.extSettings.arduinoOKCommand+arduinoUtilities.arduinoCommandSplitChar);
                                },100);

                                //Step 3: Attach readable event for when we recieve data
                                curPort.on('readable', function(dataStream) {
                                    let realData = curPort.read();
                                    if (arduinoUtilities.debugMode) {
                                        console.log("[ARDUINO] init check data recieved: '"+realData+"'");
                                    }
                                    if (realData.indexOf("EXIST|true") >= 0) {
                                        curPort.close();
                                        clearTimeout(dataRecvTimeout); //remove data recieve timeout
                                        clearInterval(startCmdSendInterval); //remove data send interval
                                        if (arduinoUtilities.debugMode) {
                                            console.log("[ARDUINO] found port: "+curPortID);
                                        }
                                        arduinoUtilities.arduinoConnected = true;
                                        return resolve(curPortID);
                                    } else {
                                        if (arduinoUtilities.debugMode) {
                                            console.log("[ARDUINO] Currently open testing port returned garbled data: '"+realData+"'");
                                        }
                                    }
                                });
                            }
                        })
                    } catch(error) {
                        portFailed(portNum, curPortID, "PORT_CREATE_ERR");
                    }
                }

                var portFailed = (portNum, curPortID, reason) => {
                    if (typeof reason == "undefined") {
                        reason = "not specified";
                    }
                    if (typeof curPortID == "undefined") {
                        curPortID = "not specified";
                    }

                    if (portNum >= portsList.length) { //have we reached the end of the ports list?
                        return reject("Testing all ports for arduino failed; is it connected properly?");
                    } else {
                        if (arduinoUtilities.debugMode) {
                            console.log("[ARDUINO] Testing port '"+curPortID+"' failed to open because: '"+reason+"'; moving on");
                        }
                        testPortN(portNum+1); //recurse lmao
                    }
                }

                //Proper response: EXIST|true;

                if (arduinoUtilities.debugMode) {
                    console.log("[ARDUINO] PortList: "+JSON.stringify(portsList));
                    console.log("Now testing ports...");
                }
                testPortN(0); //start testing ports
            }).catch(err => {
                return reject("Error getting portList: "+err);
            })
        })
    },

    connectArduino: function(arduinoAddr) { //start new arduino connection with
        return new Promise((resolve, reject) => {
            try {
                arduinoUtilities.arduinoObject.close(); //attempt to close previous connection
            } catch(e){}
            arduinoUtilities.arduinoObject = new serialPort(arduinoAddr, {
                baudRate: arduinoUtilities.extSettings.arduinoBaudRate,
                autoOpen: false //don't open it yet
            });
            arduinoUtilities.arduinoObject.open(function (err) { //and open the port
                if (err) { //arduino was connected in previous server iteration and was disconnected?
                    console.warn("[WARNING] Server running without valid arduino. Errors may occur. Once you have reconnected an arduino, you have to relaunch the start script (unless it is on the same port).");
                    arduinoUtilities.setArduinoFakeClass();
                    reject("Error opening serial port to arduino at "+arduinoAddr+" (err="+err+")");
                } else {
                    console.log("Arduino connected successfully");
                    arduinoUtilities.arduinoObject.on('readable', function(data) { //set up readable event
                        arduinoUtilities.handleArduinoData(arduinoUtilities.arduinoObject.read()).catch(e => {
                            console.error("[ARDUINO] HandleArduinoData failed with message: "+e);
                        }); //pass reference
                    });
                    return resolve();
                }
            })
        });
    },

    handleArduinoData: function(data) {
        if (arduinoUtilities.debugMode) {
            console.log("[ARDUINO] raw data recv: '"+data+"'");
        }
        return new Promise((resolve, reject) => {
            let sData = String(data).split("");
            for (let i=0; i<sData.length; i++) {
                arduinoUtilities.arduinoCommandBuffer+=sData[i];
                if (sData[i] == ";") { //we've reached the end of a command
                    arduinoUtilities.commandQueue.checkForCompletions(arduinoUtilities.arduinoCommandBuffer.toLowerCase());
                    arduinoUtilities.arduinoCommandBuffer = ""; //reset command buffer
                }
            }
            return resolve();
        });
    },

    setupExistenceCheck: function(runtimeInfo) {
        return new Promise((resolve, reject) => {
            if (arduinoUtilities.existenceCheckPresent) { //Prevent multiple existence checks
                console.warn("[ARDUINO] Existence check has already been started");
                return reject();
            } else {
                arduinoUtilities.existenceCheckPresent = true;

                setInterval( () => {
                    arduinoUtilities.sendCommand("ex", "", "exist", "true").then(() => {
                        if (arduinoUtilities.debugMode) {
                            console.log("[ARDUINO] existence testing finished; arduino passed existence check");
                        }
                        runtimeInfo.arduinoConnected = true;
                        arduinoUtilities.arduinoConnected = true;
                    }).catch(err => {
                        if (arduinoUtilities.debugMode) {
                            console.log("[ARDUINO] existence testing failed; Arduino disconnected");
                        }
                        runtimeInfo.arduinoConnected = false;
                        arduinoUtilities.arduinoConnected = false;
                    });

                }, arduinoUtilities.extSettings.arduinoCheckPresentInterval);

                return resolve();
            }
        });
    },

    setupQueueCommandSending: function() {
        return new Promise((resolve, rejet) => {
            setInterval(() => {
                if (arduinoUtilities.debugMode && arduinoUtilities.commandQueue.queue.length > 0) {
                    arduinoUtilities.commandQueue.queueDump();
                }
                if (arduinoUtilities.commandQueue.hasElemThatCanSendCommand()) {
                    let elem = arduinoUtilities.commandQueue.getTopElemWithCommand();
                    let rawCommand = elem.commandToSend;
                    if (arduinoUtilities.debugMode) {
                        console.log("Queue isNot empty, sending command='"+rawCommand+"'");
                    }

                    //Ensure arduinoObject can actually send data
                    if (typeof arduinoUtilities.arduinoObject == "undefined") {
                        arduinoUtilities.setArduinoFakeClass(); //if it's undefined set the fake class in case it hasn't been done already
                    }

                    arduinoUtilities.arduinoObject.write(rawCommand);
                }/* else {
                    if (arduinoUtilities.debugMode) {
                        console.log("Queue is empty of valid elements");
                    }
                }*/
            },arduinoUtilities.extSettings.arduinoSendCommandInterval);

            return resolve();
        });
    },

    sendCommand: function(command, value, responseCommand, responseValue) {
        responseCommand = responseCommand || command.toLowerCase(); //Response represents the command ID that we expect to recieve
        var acceptedResponse;
        if (responseValue) { //if we're looking for a specific value, make the response include that
            acceptedResponse = responseCommand+arduinoUtilities.arduinoCommandValueChar+responseValue+arduinoUtilities.arduinoCommandSplitChar;
        } else {
            acceptedResponse = responseCommand;
        }

        var fullCommand = arduinoUtilities.getValidCommandStr(command, value);
        return new Promise((resolve, reject) => {
            //Set up the command queue item
            arduinoUtilities.commandQueue.addItem(fullCommand, acceptedResponse).then(resp => {
                if (resp.indexOf(arduinoUtilities.arduinoCommandSplitChar) >= 0) { //Remove the trailing semicolon if it exists
                    resp = resp.substring(0, resp.lastIndexOf(arduinoUtilities.arduinoCommandSplitChar));
                }

                if (resp.indexOf(arduinoUtilities.arduinoCommandValueChar) >= 0) {
                    let splitResp = resp.split(arduinoUtilities.arduinoCommandValueChar);
                    if (splitResp.length == 1) { //No value case
                        return resolve(splitResp[0]);
                    } else if (splitResp.length == 2) { //Single value case
                        return resolve(splitResp[1]);
                    } else { //Multiple values case
                        let returnArr = [];
                        for (let i=1; i<splitResp.length; i++) {
                            returnArr.push(splitResp[i]);
                        }
                        return resolve(returnArr);
                    }
                }
                //If none of the special cases need to happen, just return the raw command, since we don't know what to do with it
                return resolve(resp);
            }).catch(err => {
                return reject(err);
            });
            
        });
    },

    getValidCommandStr: function(command, value) {
        var finalCommand;
        if (typeof value != "undefined" && value != "") { //ensure value is not blanks
            finalCommand = command+arduinoUtilities.arduinoCommandValueChar+value+arduinoUtilities.arduinoCommandSplitChar;
        } else {
            finalCommand = command+arduinoUtilities.arduinoCommandSplitChar;
        }
        return finalCommand;
    },

    setArduinoFakeClass: function() { //Allows "emulation" of real arduino serial port class in order to allow code to run normally on system without arduino connected
        arduinoUtilities.arduinoObject = { //make a fake arduino class so that server doesnt fail on write
            write: function(t) {
                console.warn("[WARNING] Arduino.write method called with no arduino connected, data is literally going nowhere");
            },
            read: function() {
                return "";
            }
        }
    }
}

module.exports = arduinoUtilities;
    
