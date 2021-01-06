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

		/* DRAW OPTIONS (stroke width, default color, etc) */
		strokeWidth: 1, //px
		stateFontSize: 25, //px (15 big)
		dataFontSize: 16,
		barFontSize: 16,
		bgColor: "#002", //html color
		strokeColor: "#ddd", //html color

		/* OTHER OPTIONS */
		states: [
			[0, "FC Booting", "#050"],
			[1, "TLM Conn Wait", "#0ed"],
			[2, "TLM Conn Established", "#5f9"],
			[3, "Flight", "#ff0"],
			[4, "Descent", "#e0a"],
			[5, "Copying SD", "#0c0"],
			[6, "Landed", "#50f"]
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
		["velAcc", "UNCVel", "m", -1],

		["pyro1", "PyroCh1", "", 0],
		["pyro2", "PyroCh2", "", 0],
		["pyro3", "PyroCh3", "", 0],
		["pyro4", "PyroCh4", "", 0],
		["pyro5", "PyroCh5", "", 0],
	]

	let barWidth = this.options.width/2.2;
	let barHeight = (this.options.height-this.options.heightBanner)/(this.data.length/2)-(0.008*getPageHeight());

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
		max: -50,
		units: this.getBarUnits("signal")
	});
	this.pdopBar = new A_Bar(this.canvasID, {
		width: barWidth,
		height: barHeight,
		x: this.getDataX("pDOP"),
		y: this.getDataY("pDOP"),
		title: this.getBarTitle("pDOP"),
		fontSize: this.options.barFontSize,
		min: 1.25,
		max: 6,
		reverseColors: true,
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
	} else {
		let found = false;
		for (let i=0; i<this.options.states.length; i++) {
			found = true;
			let stateO = this.options.states[i];
			if (stateO[0] == state) {
				stateText = stateO[1];
				stateColor = stateO[2];
			}
		}
		if (!found) {
			stateText = this.defaultState[0];
			stateColor = this.defaultState[1];
		}
	}

	this.ctx.fillStyle = stateColor;
	this.drawOuterBox(this.options.bannerDistFromEdge, this.options.bannerDistFromEdge, this.options.width-2*this.options.bannerDistFromEdge, this.options.heightBanner-2*this.options.bannerDistFromEdge, 5, true);

	let rgb = hexToRgb(stateColor);
	let brightness = Math.round(((rgb.r * 299) + (rgb.g * 587) + (rgb.b * 114)) / 1000);
	this.ctx.fillStyle = (brightness > 125) ? "#000" : "#fff";
	this.ctx.font = this.options.stateFontSize+"px Helvetica";
	let width = this.ctx.measureText(stateText).width;
	this.ctx.fillText(stateText, (this.options.width-width)/2, this.options.bannerDistFromEdge+(this.options.heightBanner/2));
}

A_StateIndicator.prototype.updateData = function(dIn) {
	// (battV, rollV, servoV, vehicleState, pyroState, temp, signal, tlmRate, fixType, pDOP, horizAcc, vertAcc, gpsSats)
	//Run thru data in and copy to this.data where applicable
	if (!dIn) return;
	for (let i=0; i<this.data.length; i++) {
		let key = this.data[i][0];
		if (dIn.hasOwnProperty(key)) { //does it exist?
			if (typeof dIn[key] != "undefined") { //does it exist pt 2?
				this.data[i][3] = dIn[key]; //override it!
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
			case "velAcc":
				this.ctx.fillText(d[1]+": "+d[3]+d[2], tX, tY);
				break;
			case "pyroState":
				this.ctx.fillStyle = d[3]?"#0f0":"#f00";
				this.ctx.fillText(d[1]+": "+(d[3]?"Armed":"Disarmed"), tX, tY);
				this.ctx.fillStyle = this.options.strokeColor;
				break;
			case "pyro1":
			case "pyro2":
			case "pyro3":
			case "pyro4":
			case "pyro5":
				this.ctx.fillStyle = (d[3]==0)?"#aa0":(d[3]==1)?"#0f0":"#f00";
				this.ctx.fillText(d[1]+": "+((d[3]==0)?"NC":(d[3]==1)?"Cont":"FIRE"), tX, tY);
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

function getPageHeight() {
  return Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.offsetHeight,
    document.documentElement.clientHeight
  );
}

function hexToRgb(hex) {
	if (hex.length == 3 || hex.length == 4) {
		let fHex = "#";
		for (i=(hex[0] == "#")?1:0; i<hex.length; i++) {
			fHex+=hex[i];
			fHex+=hex[i];
		}
		hex = fHex;
	}
	var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result ? { //NUTTY expression here
		r: parseInt(result[1], 16),
		g: parseInt(result[2], 16),
		b: parseInt(result[3], 16)
	} : null;
}