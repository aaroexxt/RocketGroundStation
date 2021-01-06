/*
* Streamlined version of arduino.js from Skreen
* Written by Aaron Becker
*
* Dedicated to Marc Perkel
*
*/

const serialPort = require('serialport'); //require serialport driver
const deviceCommandQueue = require('./deviceCommandQueue.js');

const debugMode = false;


/*


DEFAULT COMMAND HANDLER (for when queue=0)


*/
const settings = {
	commandTimeout: 8000,
	baudRate: 9600,
	portCheckTimeout: 6000,
	sendCommandInterval: 1000,
	checkPresentInterval: 10000,
	commands: {
		ok: "ex"
	},
	splitC: ";",
	valueC: "|"
}

var transmitter = {
	buffer: "",
	existenceCheckPresent: false,
	initialized: false,
	status: {
		tConnected: false,
		set connected(c) { //nutE es6 setters n getters
			if (c == this.tConnected) return; //only update on actual state change

			this.tConnected = c;
			_this.fnCD(c); //call update function
		},
		get connected() {
			return this.tConnected;
		}
	}
}
var _this = transmitter; //store reference

transmitter.init = function(fnConnectDisconnect, fnDefaultHandler) {
	return new Promise((resolve, reject) => {
		if (this.initialized) return resolve();
		
		this.commandQueue = new deviceCommandQueue("TransmitterQueue", settings.commandTimeout, false, debugMode);

		this.fnCD = fnConnectDisconnect;
		this.defaultHandler = fnDefaultHandler;
		this.status.connected = false;

		if (!this.cIntervals) {
			this.cIntervals = true;

			//Command queue resend interval
			setInterval(() => {
	            if (debugMode && this.commandQueue.queue.length > 0) {
	                this.commandQueue.queueDump();
	            }
	            if (this.commandQueue.hasElemThatCanSendCommand()) {
	                let elem = this.commandQueue.getTopElemWithCommand();
	                let rawCommand = elem.commandToSend;
	                if (debugMode) {
	                    console.log("[TMIT] Queue isNot empty, sending command='"+rawCommand+"'");
	                }

	                this.serial.write(rawCommand);
	            }
	        }, settings.sendCommandInterval);

			//Transmitter present interval
			setInterval( () => {
	            	this.checkTransmitterPresent();
	        }, settings.checkPresentInterval);
		}

		//Immediately check transmitter
		this.checkTransmitterPresent();

		this.initialized = true;
	})
}

transmitter.find = function() {
	return new Promise((resolve, reject) => {
        var portsList = [];

        serialPort.list().then( ports => {
            ports.forEach((port) => {
                let path = port.path || port.comName;
                if (path.toLowerCase().indexOf("bluetooth") == -1 && path.toLowerCase().indexOf("wireless") == -1) portsList.push(path); //mac or windows
            });

            var testPortN = portNum => { //test port at number n of portsList
                let curPortID = portsList[portNum];
                try {
                    let curPort = new serialPort(curPortID, {
                        baudRate: settings.baudRate,
                        autoOpen: false //don't open it yet
                    });
                    curPort.open(function (err) {
                        if (err) {
                            portFailed(portNum, curPortID, "OPENING_FAIL");
                        } else {
                            //Step 1: Set max data time recv timeout
                            let dataRecvTimeout = setTimeout(() => {
                                if (curPort && curPort.isOpen) curPort.close();
                                clearInterval(startCmdSendInterval); //remove data send interval
                                portFailed(portNum, curPortID, "DATA_RECV_TIMEOUT");
                            }, settings.portCheckTimeout);

                            //Step 2: Start sending existence check commands every 250ms
                            let startCmdSendInterval = setInterval(() => {
                                curPort.write(settings.commands.ok+settings.splitC);
                            },500);

                            //Step 3: Attach readable event for when we recieve data

                            let handleReadable = function(dataStream) {
                            	curPort.removeListener('readable', handleReadable);
                            	let realData = curPort.read();
                                if (debugMode) {
                                    console.log("[TMIT] init check data recieved: '"+realData+"'");
                                }
                                if (realData.indexOf("EXIST|true") >= 0) {
                                    _this.serial = curPort;
                                    _this.serial.on('readable', _this.handleData);

                                    clearTimeout(dataRecvTimeout); //remove data recieve timeout
                                    clearInterval(startCmdSendInterval); //remove data send interval
                                    if (debugMode) {
                                        console.log("[TMIT] found port: "+curPortID);
                                    }
                                    _this.status.connected = true;
                                    return resolve(curPortID);
                                } else {
                                    if (debugMode) {
                                        console.log("[TMIT] Currently open testing port returned garbled data: '"+realData+"'");
                                    }
                                }
                            }
                            curPort.on('readable', handleReadable);
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
                    return reject("ALLPORT_FAIL: Testing all ports failed; is it connected properly?");
                } else {
                    if (debugMode) {
                        console.log("[TMIT] Testing port '"+curPortID+"' failed to open because: '"+reason+"'; moving on");
                    }
                    testPortN(portNum+1); //recurse lmao
                }
            }

            //Proper response: EXIST|true;

            if (debugMode) {
                console.log("[TMIT] PortList: "+JSON.stringify(portsList));
                console.log("Now testing ports...");
            }
            testPortN(0); //start testing ports
        }).catch(err => {
            return reject("Error getting portList: "+err);
        })
    })
}

transmitter.handleData = function() {
    return new Promise((resolve, reject) => {
    	let data = _this.serial.read();
    	if (debugMode) console.log("[TMIT] raw data recv: '"+data+"'");
        let sData = String(data).split("");
        for (let i=0; i<sData.length; i++) {
            _this.buffer+=sData[i];
            if (sData[i] == settings.splitC) { //we've reached the end of a command
                let found = _this.commandQueue.checkForCompletions(_this.buffer);
                if (!found && _this.buffer.indexOf("EXIST|true") == -1) {
                	_this.defaultHandler(_this.buffer);
                }
                _this.buffer = ""; //reset command buffer
            }
        }
        return resolve();
    });
}

transmitter.getValidCommandStr = function(command, value) {
    var finalCommand;
    if (typeof value != "undefined" && value != "") { //ensure value is not blanks
        finalCommand = command+settings.valueC+value+settings.splitC;
    } else {
        finalCommand = command+settings.splitC;
    }
    return finalCommand;
}

transmitter.sendCommand = function(command, value, responseCommand, responseValue) {
    responseCommand = responseCommand || command.toLowerCase(); //Response represents the command ID that we expect to recieve
    var acceptedResponse;
    if (responseValue) { //if we're looking for a specific value, make the response include that
        acceptedResponse = responseCommand+settings.valueC+responseValue+settings.splitC;
    } else {
        acceptedResponse = responseCommand;
    }

    var fullCommand = this.getValidCommandStr(command, value);
    return new Promise((resolve, reject) => {
        //Set up the command queue item
        this.commandQueue.addItem(fullCommand, acceptedResponse).then(resp => {
            if (resp.indexOf(settings.splitC) >= 0) { //Remove the trailing semicolon if it exists
                resp = resp.substring(0, resp.lastIndexOf(settings.splitC));
            }

            if (resp.indexOf(settings.valueC) >= 0) {
                let splitResp = resp.split(settings.valueC);
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
}

transmitter.checkTransmitterPresent = function() {
	const fail = e => {
        console.log("[TMIT] existence testing failed; disconnected (e="+e+")");
        _this.status.connected = false;

	    try {
            if (_this.serial && _this.serial.isOpen) _this.serial.close(); //close it
            _this.serial.removeListener('readable', _this.handleData); //remove listener
        } catch(e) {}
    }

	if (this.status.connected) { //if we're already connected, check for it
		this.sendCommand("ex", "", "EXIST", "true").then(() => {
            if (debugMode) {
                console.log("[TMIT] existence testing finished; passed existence check");
            }
            this.status.connected = true;
        }).catch(fail);
	} else { //if not, try to rediscover and connect
		this.find().then(port => {
			if (debugMode) {
				console.log("[TMIT] (re) discovered txmitter; connected");
			}
            this.status.connected = true;
		}).catch(fail);
	}
}


module.exports = transmitter;