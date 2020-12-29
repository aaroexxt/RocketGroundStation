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
 * including commercial applications, and to alter it and redistribute it
 * freely, subject to the following restrictions:
 *
 *    1. The origin of this software must not be misrepresented; you must not
 *    claim that you wrote the original software. If you use this software
 *    in a product, an acknowledgment in the product documentation would be
 *    appreciated but is not required.
 *
 *    2. Altered source versions must be plainly marked as such, and must not
 *    be misrepresented as being the original software.
 *
 *    3. This notice may not be removed or altered from any source
 *    distribution.
 */

 /* Dependency initialization */

 //Basic Dependencies
const fs = require('fs');
const path = require('path');
const express = require('express');
const ejs = require('ejs');
const app = express();
const http = require('http').Server(app);
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

app.use(cors()); //enable cors

app.use(bodyParser.urlencoded({ extended: true })); //, limit: '50mb' })); //bodyparser for getting json data
app.use(bodyParser.json());
app.use(express.static("assets")); //define a static assets directory
app.set('view engine', 'ejs'); //ejs gang

app.get('/status', (req, res) => {
    return res.end(RequestHandler.SUCCESS());
});

app.use(function(req, res, next){ //anything else that doesn't match those filters
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
});

console.log("Starting server");
const port = process.env.PORT || 80;

const server = http.listen(port, () => {
  console.log('RocketGroundStation is running on port', server.address().port);
});