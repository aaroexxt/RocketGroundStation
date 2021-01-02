/*
State indicator lolz
Written by Aaron Becker
*/

var A_StateIndicator = function(canvasID, opts) {
	this.canvasID = canvasID;
	this.canvas = document.getElementById(canvasID);
	this.ctx = this.canvas.getContext('2d');
	this.options = { //setup default opts object
		/* BASIC PARAMS (width, height, etc) */
		width: 350, //px
		height: 150, //px
		heightBanner: 50,
		dataColHeight: 30,
		fpsUpdate: 30,

		/* DRAW OPTIONS (stroke width, default color, etc) */
		strokeWidth: 1, //px
		titleFontSize: 30, //px (15 big)
		dataFontSize: 12,
		bgColor: "#000", //html color
		strokeColor: "#ddd", //html color
		titleColor: "#a00",

		/* OTHER OPTIONS */
		states: [
			["Startup", "#fff"],
			["PostStartup", "#f00"]
		]
	}

	//Now, we loop through opts to see if we should override any of the default options
	let keys = Object.keys(this.options);
	for (let i=0; i<keys.length; i++) {
		if (opts.hasOwnProperty(keys[i])) { //does it exist?
			if (typeof opts[keys[i]] != "undefined") { //does it exist pt 2?
				this.options[keys[i]] = opts[keys[i]]; //override it!
			}
		}
	}

	this.construct();

	this.data = [
		["battV", "AVI Batt", "V", 0],
		["state", "Sys State", "", 0],

		["rollV", "RollReg", "V", 0],
		["pyroState", "Pyro State", "", false],

		["servoV", "ServoReg", "V", 0],
		["temp", "Board T", "°F", 0],

		["signal", "SigStrength", "dbm", 0],
		["tlmRate", "TLM Rate", "p/sec", 0],

		["pDOP", "pDOP", "", 0],
		["gpsSats", "GPS Sats", "", 0],

		["horizAcc", "UNCHoriz", "m", 0],
		["vertAcc", "UNCVert", "m", 0]
	]

	let barWidth = this.options.width/2.2;
	let barHeight = (this.options.height-this.options.heightBanner)/(this.data.length/2);


	console.log(barWidth, barHeight)
	this.battVBar = new A_Bar(this.canvasID, {
		width: barWidth,
		height: barHeight,
		x: this.getBarX("battV"),
		y: this.getBarY("battV"),
		fontSize: this.options.dataFontSize,
		min: 9.6,
		max: 12.6,
		units: this.getBarUnits("battV")
	});
	this.rollVBar = new A_Bar(this.canvasID, {
		width: barWidth,
		height: barHeight,
		x: this.getBarX("rollV"),
		y: this.getBarY("rollV"),
		fontSize: this.options.dataFontSize,
		min: 5.8,
		max: 6,
		units: this.getBarUnits("rollV")
	});
	this.servoVBar = new A_Bar(this.canvasID, {
		width: barWidth,
		height: barHeight,
		x: this.getBarX("servoV"),
		y: this.getBarY("servoV"),
		fontSize: this.options.dataFontSize,
		min: 8,
		max: 8.4,
		units: this.getBarUnits("servoV")
	});
	this.sigBar = new A_Bar(this.canvasID, {
		width: barWidth,
		height: barHeight,
		x: this.getBarX("signal"),
		y: this.getBarY("signal"),
		fontSize: this.options.dataFontSize,
		min: -90,
		max: -20,
		units: this.getBarUnits("signal")
	});
	this.pdopBar = new A_Bar(this.canvasID, {
		width: barWidth,
		height: barHeight,
		x: this.getBarX("pDOP"),
		y: this.getBarY("pDOP"),
		fontSize: this.options.dataFontSize,
		min: 6,
		max: 1.25,
		units: this.getBarUnits("pDOP")
	});

	this.construct();


	// (battV, rollV, servoV, state, pyroState, temp, signal, tlmRate, fixType, pDOP, horizAcc, vertAcc, gpsSats)

	//this.updateInterval = setInterval(() => {this.update();}, 1000/this.options.fpsUpdate);
}

A_StateIndicator.prototype.clear = function() {
	this.ctx.fillStyle = this.options.bgColor;
	this.ctx.fillRect(0, 0, this.options.width, this.options.height);
}

A_StateIndicator.prototype.update = function(data) {
	if (data.length == 0) return;

	let dKeys = Object.keys(data);

	let redraw = false;
	for (let i = 0; i<dKeys.length; i++) {
		for (let j=0; j<this.data.length; j++) {
			if (this.data[j][0] == dKeys[i]) {
				this.data[j][3] = data[dKeys[i]];
				redraw = true;
				break; //break out of inner loop
			}
		}
	}

	if (redraw) this.construct();
}


A_StateIndicator.prototype.drawOuterBox = function(x, y, width, height, radius) {
	this.ctx.strokeStyle = this.options.strokeColor;
	this.ctx.fillStyle = this.options.strokeColor;
	this.ctx.lineWidth = this.options.strokeWidth;

	if (typeof radius === 'number') {
		radius = {tl: radius, tr: radius, br: radius, bl: radius};
	} else {
		var defaultRadius = {tl: 0, tr: 0, br: 0, bl: 0};
		for (var side in defaultRadius) {
		  radius[side] = radius[side] || defaultRadius[side];
		}
	}

	this.ctx.beginPath();
	this.ctx.moveTo(x + radius.tl, y);
	this.ctx.lineTo(x + width - radius.tr, y);
	this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr); //bruh for some reason you have to use curves for this lmao
	this.ctx.lineTo(x + width, y + height - radius.br);
	this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
	this.ctx.lineTo(x + radius.bl, y + height);
	this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
	this.ctx.lineTo(x, y + radius.tl);
	this.ctx.quadraticCurveTo(x, y, x + radius.tl, y);
	this.ctx.closePath();
	this.ctx.stroke();
}

A_StateIndicator.prototype.getBarX = function(name) {
	for (let i=0; i<this.data.length; i++) {
		if (this.data[i][0] == name) {
			return 5+(i%2)*(this.options.width/2);
		}
	}
	return 0;
}

A_StateIndicator.prototype.getBarY = function(name) {
	for (let i=0; i<this.data.length; i++) {
		if (this.data[i][0] == name) {
			let barHeight = (this.options.height-this.options.heightBanner)/(this.data.length/2);
			return this.options.heightBanner+(barHeight*(i/2));
		}
	}
	return 0;
}

A_StateIndicator.prototype.getBarUnits = function(name) {
	for (let i=0; i<this.data.length; i++) {
		if (this.data[i][0] == name) {
			return this.data[i][2];
		}
	}
	return "";
}

A_StateIndicator.prototype.drawDivLine = function() {
	this.ctx.strokeStyle = this.options.strokeColor;
	this.ctx.fillStyle = this.options.strokeColor;
	this.ctx.lineWidth = this.options.strokeWidth;

	this.ctx.beginPath();
	this.ctx.moveTo(this.options.width/2, this.options.height-this.options.strokeWidth);
	this.ctx.lineTo(this.options.width/2, this.options.heightBanner+10);
	this.ctx.stroke();
}


A_StateIndicator.prototype.construct = function() {
	// this.clear();
	this.drawOuterBox(this.options.strokeWidth, this.options.strokeWidth, this.options.width-(2*this.options.strokeWidth), this.options.height-(2*this.options.strokeWidth), 10);
	this.drawDivLine();

	// this.drawStateBanner();
	let x = 0;
}