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
		heightBanner: 55,
		bannerDistFromEdge: 10,
		dataColHeight: 30,

		/* DRAW OPTIONS (stroke width, default color, etc) */
		strokeWidth: 1, //px
		stateFontSize: 25, //px (15 big)
		dataFontSize: 14,
		barFontSize: 14,
		bgColor: "#000", //html color
		strokeColor: "#ddd", //html color

		/* OTHER OPTIONS */
		states: [
			["Startup", "#fff"],
			["PostStartup", "#0c0"]
		]
	},
	this.defaultState = ["Disconnected", "#e00"];

	//Now, we loop through opts to see if we should override any of the default options
	let keys = Object.keys(this.options);
	for (let i=0; i<keys.length; i++) {
		if (opts.hasOwnProperty(keys[i])) { //does it exist?
			if (typeof opts[keys[i]] != "undefined") { //does it exist pt 2?
				this.options[keys[i]] = opts[keys[i]]; //override it!
			}
		}
	}

	this.data = [
		["battV", "AVIBatt", "V", -1],
		["vehicleState", "Sys State", "", -1],

		["rollV", "Roll", "V", -1],
		["pyroState", "Pyro State", "", false],

		["servoV", "Servo", "V", -1],
		["temp", "Board T", "°F", -1],

		["signal", "Sig", "dbm", -1],
		["tlmRate", "TLM Rate", "p/sec", -1],

		["pDOP", "pDOP", "", -1],
		["gpsSats", "GPS Sats", "", -1],

		["horizAcc", "UNCHoriz", "m", -1],
		["vertAcc", "UNCVert", "m", -1],

		["pCont1", "PyroCh1", "", false],
		["pCont2", "PyroCh2", "", false],
		["pCont3", "PyroCh3", "", false],
		["pCont4", "PyroCh4", "", false],
		["pCont5", "PyroCh5", "", false],
		["pCont6", "PyroCh6", "", false],
	]

	let barWidth = this.options.width/2.2;
	let barHeight = (this.options.height-this.options.heightBanner)/(this.data.length/2)-2;

	this.battVBar = new A_Bar(this.canvasID, {
		width: barWidth,
		height: barHeight,
		x: this.getDataX("battV"),
		y: this.getDataY("battV"),
		title: this.getBarTitle("battV"),
		fontSize: this.options.barFontSize,
		min: 9.6,
		max: 12.6,
		units: this.getBarUnits("battV")
	});
	this.rollVBar = new A_Bar(this.canvasID, {
		width: barWidth,
		height: barHeight,
		x: this.getDataX("rollV"),
		y: this.getDataY("rollV"),
		title: this.getBarTitle("rollV"),
		fontSize: this.options.barFontSize,
		min: 5.8,
		max: 6,
		units: this.getBarUnits("rollV")
	});
	this.servoVBar = new A_Bar(this.canvasID, {
		width: barWidth,
		height: barHeight,
		x: this.getDataX("servoV"),
		y: this.getDataY("servoV"),
		title: this.getBarTitle("servoV"),
		fontSize: this.options.barFontSize,
		min: 8,
		max: 8.4,
		units: this.getBarUnits("servoV")
	});
	this.sigBar = new A_Bar(this.canvasID, {
		width: barWidth,
		height: barHeight,
		x: this.getDataX("signal"),
		y: this.getDataY("signal"),
		title: this.getBarTitle("signal"),
		fontSize: this.options.barFontSize,
		min: -90,
		max: -20,
		units: this.getBarUnits("signal")
	});
	this.pdopBar = new A_Bar(this.canvasID, {
		width: barWidth,
		height: barHeight,
		x: this.getDataX("pDOP"),
		y: this.getDataY("pDOP"),
		title: this.getBarTitle("pDOP"),
		fontSize: this.options.barFontSize,
		min: 6,
		max: 1.25,
		units: this.getBarUnits("pDOP")
	});

	this.updateData([]);


	// (battV, rollV, servoV, vehicleState, pyroState, temp, signal, tlmRate, fixType, pDOP, horizAcc, vertAcc, gpsSats)

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


A_StateIndicator.prototype.drawOuterBox = function(x, y, width, height, radius, fill) {
	this.ctx.strokeStyle = this.options.strokeColor;
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

	if (fill) {
		this.ctx.fill();
	}
}

A_StateIndicator.prototype.getDataX = function(name) {
	for (let i=0; i<this.data.length; i++) {
		if (this.data[i][0] == name) {
			return 5+(i%2)*(this.options.width/2);
		}
	}
	return 0;
}

A_StateIndicator.prototype.getDataY = function(name) {
	let barHeight = ((this.options.height-this.options.heightBanner)/(this.data.length/2));
	let rowDistance = (this.options.height-this.options.heightBanner-(Math.ceil(this.data.length/2)*barHeight))/(this.data.length)
	for (let i=0; i<this.data.length; i++) {
		if (this.data[i][0] == name) {
			return this.options.heightBanner+((barHeight+rowDistance)*(Math.floor(i/2)))-5;
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

A_StateIndicator.prototype.getBarTitle = function(name) {
	for (let i=0; i<this.data.length; i++) {
		if (this.data[i][0] == name) {
			return this.data[i][1];
		}
	}
	return "";
}

A_StateIndicator.prototype.getDataValue = function(name) {
	for (let i=0; i<this.data.length; i++) {
		if (this.data[i][0] == name) {
			return this.data[i][3];
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
	this.ctx.lineTo(this.options.width/2, this.options.heightBanner-5);
	this.ctx.stroke();
}

A_StateIndicator.prototype.drawStateBanner = function(state) {
	let stateText, stateColor;
	if (state == -1 || state == "") {
		stateText = this.defaultState[0];
		stateColor = this.defaultState[1];
	}

	this.ctx.fillStyle = stateColor;
	this.drawOuterBox(this.options.bannerDistFromEdge, this.options.bannerDistFromEdge, this.options.width-2*this.options.bannerDistFromEdge, this.options.heightBanner-2*this.options.bannerDistFromEdge, 5, true);

	this.ctx.fillStyle = this.options.strokeColor;
	this.ctx.font = this.options.stateFontSize+"px Helvetica";
	let width = this.ctx.measureText(stateText).width;
	this.ctx.fillText(stateText, (this.options.width-width)/2, this.options.bannerDistFromEdge+(this.options.heightBanner/2));
}

A_StateIndicator.prototype.updateData = function(dIn) {
	// (battV, rollV, servoV, vehicleState, pyroState, temp, signal, tlmRate, fixType, pDOP, horizAcc, vertAcc, gpsSats)
	//Run thru data in and copy to this.data where applicable
	if (!dIn) return;
	let keys = Object.keys(this.data);
	for (let i=0; i<keys.length; i++) {
		if (dIn.hasOwnProperty(keys[i])) { //does it exist?
			if (typeof dIn[keys[i]] != "undefined") { //does it exist pt 2?
				this.data[keys[i]] = dIn[keys[i]]; //override it!
			}
		}
	}

	this.construct(); //start with banner draw in reconstruct

	for (let i=0; i<this.data.length; i++) {
		let d = this.data[i];
		switch (d[0]) {
			case "battV":
				this.battVBar.update(d[3]);
				break;
			case "rollV":
				this.rollVBar.update(d[3]);
				break;
			case "servoV":
				this.servoVBar.update(d[3]);
				break;
			case "signal":
				this.sigBar.update(d[3]);
				break;
			case "pDOP":
				this.pdopBar.update(d[3]);
				break;
			default:
				break;
		}

		//do non bar updates
		this.ctx.strokeStyle = this.options.strokeColor;
		this.ctx.fillStyle = this.options.strokeColor;
		this.ctx.lineWidth = this.options.strokeWidth;
		this.ctx.font = this.options.dataFontSize+"px Helvetica";

		let tX = this.getDataX(d[0]);
		let tY = this.getDataY(d[0])+this.options.dataFontSize+2;

		switch (d[0]) {
			case "gpsSats":
			case "horizAcc":
			case "vertAcc":
			case "temp":
			case "tlmRate":
			case "vehicleState":
				this.ctx.fillText(d[1]+": "+d[3]+d[2], tX, tY);
				break;
			case "pyroState":
				this.ctx.fillStyle = d[3]?"#0f0":"#f00";
				this.ctx.fillText(d[1]+": "+(d[3]?"Armed":"Disarmed"), tX, tY);
				this.ctx.fillStyle = this.options.strokeColor;
				break;
			case "pCont1":
			case "pCont2":
			case "pCont3":
			case "pCont4":
			case "pCont5":
			case "pCont6":
				this.ctx.fillStyle = d[3]?"#0f0":"#aa0";
				this.ctx.fillText(d[1]+": "+(d[3]?"Cont":"NC"), tX, tY);
				this.ctx.fillStyle = this.options.strokeColor;
				break;
			default:
				break;

		}
	}
}


A_StateIndicator.prototype.construct = function() {
	//setup canvas
	this.ctx.textBaseline = 'top';
	this.canvas.width = this.options.width;
	this.canvas.height = this.options.height;

	// //Fix dpi scaling
	// let dpi = window.devicePixelRatio;
	// this.canvas.setAttribute('width', +getComputedStyle(this.canvas).getPropertyValue('width').slice(0,-2) * dpi);
	// this.canvas.setAttribute('height', +getComputedStyle(this.canvas).getPropertyValue('height').slice(0,-2) * dpi);

	this.clear();
	this.drawOuterBox(this.options.strokeWidth, this.options.strokeWidth, this.options.width-(2*this.options.strokeWidth), this.options.height-(2*this.options.strokeWidth), 10);
	this.drawDivLine();

	this.drawStateBanner(this.getDataValue("vehicleState"));
	let x = 0;
}