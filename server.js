/*
Main.js - Contains main server file
*/

/*
 * Copyright (c) Aaron Becker
 *
 * This software is provided 'as-is', without any express or implied
 * warranty. In no event will the authors be held liable for any damages
 * arising from the use of this software.
 *
 * Permission is granted to anyone to use this software for any purpose,
 * including commercial expressApplications, and to alter it and redistribute it
 * freely, subject to the following restrictions:
 *
 *    1. The origin of this software must not be misrepresented; you must not
 *    claim that you wrote the original software. If you use this software
 *    in a product, an acknowledgment in the product documentation would be
 *    expressAppreciated but is not required.
 *
 *    2. Altered source versions must be plainly marked as such, and must not
 *    be misrepresented as being the original software.
 *
 *    3. This notice may not be removed or altered from any source
 *    distribution.
 */


 /*
 BT References
 https://gist.github.com/eelcocramer/4117108
 https://github.com/leevincentwilson/arduino_bluetooth_node/blob/master/src/node/index.js
 */

 /* Navball reference
 https://github.com/msakuta/WebGL-Orbiter/tree/master/src

 https://bernii.github.io/gauge.js/
 https://canvas-gauges.com/documentation/examples/
 */

 /* Dependency initialization */

 //Basic Dependencies
const { app, BrowserWindow } = require('electron')
const fs = require('fs');
const path = require('path');
const express = require('express');
const ejs = require('ejs');
const expressApp = express();
const http = require('http').Server(expressApp);
const io = require('socket.io')(http, {
  cors: {
    origin: "http://localhost",
    methods: ["GET", "POST"]
  },
  'pingTimeout': 180000,
  'pingInterval': 25000
});

//Express dependencies
const bodyParser = require('body-parser');
const cors = require('cors');

//Addtl core deps
const RequestHandler = require("./core/requestHandler.js");

var transmitterConnected = vehicleConnected = missionStarted = false;
var vehicleConnectTime = missionStartTime = 0;
var serverStartTime = new Date().getTime();

function getTimeSinceStart() {
	return new Date().getTime() - serverStartTime;
}

const transmitter = require('./core/transmitter.js'); //require the driver;
const handleConnectDisconnect = conn => {
	console.log("txmitter connectDisconnect: "+conn);
	transmitterConnected = conn;
	if (conn) {
		io.emit("t-connect");

		transmitter.sendCommand("outputEnable", "true", "outputEnable", "true").then(() => {
			console.log("Enabled packets");
		}).catch(e => {
			console.log("Packet enabling failed? Physically restart txmitter or server");
		})
	} else {
		io.emit("t-disconnect");
	}
}

const handleDefaultCommand = command => { //when no other currently active command is matched
	let cmdSplit = command.split("|");
	if (cmdSplit[0].indexOf("vehiclePacket") > -1) {
		let vSplit = cmdSplit[1].split(",");

		let gyroBuffer = [0, 0, 0];
		let gyroCount = 0;

		let accBuffer = [0, 0, 0];
		let accCount = 0;

		let posBuffer = [0, 0, 0];
		let posCount = 0;

		let velBuffer = [0, 0, 0];
		let velCount = 0;

		let oriBuffer = [0, 0, 0];
		let oriCount = 0;

		let tvcBuffer = [0, 0, false, 0, 0, 0, 0];
		let tvcCount = 0;

		let pyroStates = [0, 0, 0, 0, 0];
		let pyroCount = 0;
		for (let i=0; i<vSplit.length; i++) {
			let vS = vSplit[i].split("=");
			if (vS.length !=2) continue;
			let name = vS[0];
			let value = vS[1];
			value = value.replace(/;/g, "").replace(/|/g, "");

			switch (name) {
				case "vehicleState":
				case "battV":
				case "rollV":
				case "servoV":
				case "temp":
				case "signal":
				case "tlmRate":
					let obj = {};
					obj[name] = value;
					io.emit("v-state", obj);
					break;
				case "pyroState":
					io.emit("v-state", {
						pyroState: (value=="1")
					})
					break;

				case "gyroX":
					gyroBuffer[0] = value;
					gyroCount++;
					break;
				case "gyroY":
					gyroBuffer[1] = value;
					gyroCount++;
					break;
				case "gyroZ":
					gyroBuffer[2] = value;
					gyroCount++;
					break;

				case "accX":
					accBuffer[0] = value;
					accCount++;
					break;
				case "accY":
					accBuffer[1] = value;
					accCount++;
					break;
				case "accZ":
					accBuffer[2] = value;
					accCount++;
					break;

				case "oriX":
					oriBuffer[0] = value;
					oriCount++;
					break;
				case "oriY":
					oriBuffer[1] = value;
					oriCount++;
					break;
				case "oriZ":
					oriBuffer[2] = value;
					oriCount++;
					break;

				case "posX":
					posBuffer[0] = value;
					posCount++;
					break;
				case "posY":
					posBuffer[1] = value;
					posCount++;
					break;
				case "posZ":
					posBuffer[2] = value;
					posCount++;
					break;

				case "velX":
					velBuffer[0] = value;
					velCount++;
					break;
				case "velY":
					velBuffer[1] = value;
					velCount++;
					break;
				case "velZ":
					velBuffer[2] = value;
					velCount++;
					break;

				case "tvcY":
					tvcBuffer[0] = value;
					tvcCount++;
					break;
				case "tvcZ":
					tvcBuffer[1] = value;
					tvcCount++;
					break;
				case "tvcActive":
					tvcBuffer[2] = (value=="1");
					tvcCount++;
					break;
				case "rollPercent":
					tvcBuffer[3] = value;
					tvcCount++;
					break;
				case "rollSetpoint":
					tvcBuffer[4] = value;
					tvcCount++;
					break;
				case "twr":
					tvcBuffer[5] = value;
					tvcCount++;
					break;
				case "mass":
					tvcBuffer[6] = value;
					tvcCount++;
					break;
				case "GNSSFix":
					io.emit("v-state", {
						fixType: value
					});
					break;
				case "GNSSpDOP":
					io.emit("v-state", {
						pDOP: value/100
					});
					break;
				case "GNSSAccHoriz":
					io.emit("v-state", {
						horizAcc: value/1000
					});
					break;
				case "GNSSAccVert":
					io.emit("v-state", {
						vertAcc: value/1000
					});
					break;
				case "GNSSAccVel":
					io.emit("v-state", {
						velAcc: value/1000
					});
					break;
				case "GNSSSats":
					io.emit("v-state", {
						gpsSats: value
					});
					break;

				case "boardTemp":
					io.emit("v-state", {
						temp: value
					});
					break;
				case "rollMotorV":
					io.emit("v-state", {
						rollV: value
					});
					break;
				case "pyro1Cont":
					pyroCount++;
					if (pyroStates[0] == 0) pyroStates[0] = (value == "1")?1:0; //if 0 override
					break;
				case "pyro2Cont":
					pyroCount++;
					if (pyroStates[1] == 0) pyroStates[1] = (value == "1")?1:0; //if 0 override
					break;
				case "pyro3Cont":
					pyroCount++;
					if (pyroStates[2] == 0) pyroStates[2] = (value == "1")?1:0; //if 0 override
					break;
				case "pyro4Cont":
					pyroCount++;
					if (pyroStates[3] == 0) pyroStates[3] = (value == "1")?1:0; //if 0 override
					break;
				case "pyro5Cont":
					pyroCount++;
					if (pyroStates[4] == 0) pyroStates[4] = (value == "1")?1:0; //if 0 override
					break;

				case "pyro1Fire":
					if (value == "1") pyroStates[0] = 2;
					break;
				case "pyro2Fire":
					if (value == "1") pyroStates[1] = 2;
					break;
				case "pyro3Fire":
					if (value == "1") pyroStates[2] = 2;
					break;
				case "pyro4Fire":
					if (value == "1") pyroStates[3] = 2;
					break;
				case "pyro5Fire":
					if (value == "1") pyroStates[4] = 2;
					break;
			}

			if (name == "tlmRate") {
				if (Number(value) > 0) {
					if (!vehicleConnected) {
						io.emit("v-connect");
						vehicleConnectTime = new Date().getTime();
					}
					vehicleConnected = true;
				} else {
					if (vehicleConnected) io.emit("v-disconnect");
					vehicleConnected = false;
				}
			}
		}

		if (gyroCount == 3) { //did we get a full set of data?
			io.emit("data-gyro", {
				x: gyroBuffer[0],
				y: gyroBuffer[1],
				z: gyroBuffer[2],
				time: getTimeSinceStart()
			})
		}

		if (accCount == 3) {
			io.emit("data-accel", {
				x: accBuffer[0],
				y: accBuffer[1],
				z: accBuffer[2],
				time: getTimeSinceStart()
			})
		}

		if (oriCount == 3) {
			io.emit("data-ori", {
				x: oriBuffer[0],
				y: oriBuffer[1],
				z: oriBuffer[2],
				time: getTimeSinceStart()
			})
		}

		if (posCount == 3) {
			io.emit("data-pos", {
				x: posBuffer[0],
				y: posBuffer[1],
				z: posBuffer[2],
				time: getTimeSinceStart()
			})
		}

		if (velCount == 3) {
			io.emit("data-vel", {
				x: velBuffer[0],
				y: velBuffer[1],
				z: velBuffer[2],
				time: getTimeSinceStart()
			})
		}

		if (tvcCount == 7) {
			io.emit("v-tvc", {
				y: tvcBuffer[0],
				z: tvcBuffer[1],
				active: tvcBuffer[2],
				rollPercent: tvcBuffer[3],
				rollSetpoint: tvcBuffer[4],
				twr: tvcBuffer[5],
				mass: tvcBuffer[6]
			})
		}

		if (pyroCount == 5) {
			io.emit("v-state", {
				pyro1: pyroStates[0],
				pyro2: pyroStates[1],
				pyro3: pyroStates[2],
				pyro4: pyroStates[3],
				pyro5: pyroStates[4]
			})
		}
	}
}

transmitter.init(handleConnectDisconnect, handleDefaultCommand);



io.on('connection', client => {
	//State updates
	if (transmitterConnected) io.emit("t-connect");
	if (vehicleConnected) {
		io.emit("v-connect");
		io.emit("vot-set", vehicleConnectTime);
	} else {
		io.emit("v-disconnect");
	}
	if (missionStarted) io.emit("met-set", missionStartTime);
	// client.on('disconnect', () => {});

	//Client uiButton clicked
	client.on('uiButton', event => {
		switch (event) {	
			case "r-launch":
				transmitter.sendCommand("setState", 3, "setState", 3);
				missionStarted = true;
				missionStartTime = new Date().getTime();
				io.emit("m-start");
				io.emit("met-set", missionStartTime);
				break;
			case "r-pyroArm":
				transmitter.sendCommand("pyroArm", "", "pyroArm", true);
				break;
			case "r-pyroDisarm":
				transmitter.sendCommand("pyroDisarm", "pyroDisarm", true);
				break;
			case "r-fire-1":
				transmitter.sendCommand("firePyro", 1, "firePyro", 1);
				break;
			case "r-fire-2":
				transmitter.sendCommand("firePyro", 2, "firePyro", 2);
				break;
			case "r-fire-3":
				transmitter.sendCommand("firePyro", 3, "firePyro", 3);
				break;
			case "r-fire-4":
				transmitter.sendCommand("firePyro", 4, "firePyro", 4);
				break;
			case "r-fire-5":
				transmitter.sendCommand("firePyro", 5, "firePyro", 5);
				break;
			case "r-vReset":
				transmitter.sendCommand("setState", 0, "setState", 0);
				missionStarted = false;
				io.emit("m-stop");
				break;

			/* Unprogrammed as of now
			case "r-abort":
			case "r-setLaunchSite":
			case "r-calib":
			case "r-vCheck":
			case "r-tvcCheck":
			*/
		}
	})

	/*
	Messages that can be sent that need to be connected to rocket
	
	DONE data-gyro -> gyro data (x, y, z, time)
	DONE data-accel => accel data (x, y, z, time)
	DONE data-ori => orientation fused frame data (x, y, z, time)
	DONE data-pos => XYZ position (x, y, z, time) with xPos being vertical position (altitude)
	DONE data-vel => XYZ velocity (x, y, z, time) with xVel being vertical velocity

	DONE v-connect => vehicle has connected, start VOT timer
	DONE v-disconnect => vehicle has disconnected, stop VOT timer
	DONE t-connect => arduino transmitter is connected
	DONE t-disconnect => arduino transitter disconnected
	DONE vot-set => set vehicle on time forcefully in ms (vot)
	met-set => set mission elapsed time forcefully in ms (met)
	m-start => mission started, start MET timer
	m-stop => mission stopped, stop MET timer

	DONE v-tvc => tvc update (y, z, active, rollPercent, rollSetpoint, twr, mass)

	v-state => various state things (battV, rollV, servoV, vehicleState, pyroState, temp, signal, tlmRate, fixType, pDOP, horizAcc, vertAcc, gpsSats)

	from software
	r-launch => launch rocket, start countdown seq
	r-abort => abort countdown sequence or rocket
	r-vCheck => perform vehicle check on rocket
	r-tvcCheck => perform tvc check on rocket
	r-pyroArm => arm pyro system
	r-pyroDisarm => disarm pyro system
	r-fire-1 => fire pyro 1
	r-fire-2 => fire pyro 2
	r-fire-3 => fire pyro 3
	r-fire-4 => fire pyro 4
	r-fire-5 => fire pyro 5
	r-calib => calibrate/bias sensor system
	r-vReset => put vehicle into init state
	r-setLaunch => set launch site from gps pos


	todo: load vehicle states from config file?
	also todo: load buttons from cfg file?
	Font resizing on mac?
	*/
});

expressApp.use(cors()); //enable cors

expressApp.use(bodyParser.urlencoded({ extended: true })); //, limit: '50mb' })); //bodyparser for getting json data
expressApp.use(bodyParser.json());
expressApp.use(express.static(path.join(__dirname,"assets"))); //define a static assets directory
expressApp.set('view engine', 'ejs'); //ejs gang

expressApp.get('/status', (req, res) => {
    return res.end(RequestHandler.SUCCESS());
});

expressApp.use(function(req, res, next){ //anything else that doesn't match those filters
	res.render('index');
});

console.log("Starting server");
const port = process.env.PORT || 80;

const server = http.listen(port, () => {
  console.log('RocketGroundStation is running on port', server.address().port);
});

function createWindow () {
	const win = new BrowserWindow({
		width: 1920,
		height: 1080,
		// autoHideMenuBar: true,
		// useContentSize: true,
		resizable:true
	})

	// win.loadFile(path.join(__dirname,"index.html"))
	win.loadURL('http://localhost:80/');
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})