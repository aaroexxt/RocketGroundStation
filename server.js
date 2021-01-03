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

//Bluetooth?

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

io.on('connection', client => {
	console.log("Client connected");

	let t = 0;
	let interv = setInterval(() => {
		io.emit("data-raw-gyro", {
			x: t/1000,
			y: -t/1000,
			z: 0,
			time: t
		})
		io.emit("data-ori", {
			x: t/1000,
			y: -t/10000,
			z: 0,
			time: t
		})
		t+=50;
	},50);

	client.on('message', data => {
		console.log("Got data: ",data);
	});
	client.on('disconnect', () => {
		console.log("Client disconnected");
		clearInterval(interv);
	});

	/*
	Messages that can be sent that need to be connected to rocket
	
	data-raw-gyro -> gyro data
	data-raw-accel => accel data
	data-raw-alt => alt data
	data-ori => orientation fused frame data
	data-yz-pos => YZ position (yPos, zPos, time)
	data-yz-vel => YZ velocity (yVel, zVel, time)

	v-connect => vehicle has connected, start VOT timer
	v-disconnect => vehicle has disconnected, stop VOT timer
	m-start => mission started, start MET timer
	v-stop => mission stopped, stop MET timer

	v-state => various state things (battV, rollV, servoV, vehicleState, pyroState, temp, signal, tlmRate, fixType, pDOP, horizAcc, vertAcc, gpsSats)
	todo: load vehicle states from config file?
	*/
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