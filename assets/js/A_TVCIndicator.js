/*
Title library meme
Written by Aaron Becker
*/

var A_TVCIndicator = function(canvasID, opts) {
	this.canvas = document.getElementById(canvasID);
	this.ctx = this.canvas.getContext('2d');
	this.options = { //setup default opts object
		/* BASIC PARAMS (width, height, etc) */
		width: 350, //px
		height: 225, //px

		/* DRAW OPTIONS (stroke width, default color, etc) */
		strokeWidth: 1, //px
		titleFontSize: 35, //px (15 big)
		dataFontSize: 15,
		bgColor: "#002", //html color
		strokeColor: "#ddd", //html color
		titleColor: "#fff",

		/* OTHER OPTIONS */
		title: "TVC",
		titleTopSpacing: 10,
		titleBottomSpacing: 3
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

	this.data = [
		["active", "", "", false],
		["yDeg", "Y+", "°", -1],
		["zDeg", "Z+", "°", -1],
		["rollPercent", "RWheel", "%", -1],
		["rollSetpoint", "RSetP", "°/sec", -1],
		["twr", "TWR", "", -1],
		["mass", "Est Mass", "kg", -1]
	]

	this.construct();
}

A_TVCIndicator.prototype.init = function() {
	this.canvas.width = this.options.width;
	this.canvas.height = this.options.height;
	this.ctx.fillStyle = this.options.bgColor;
	this.ctx.lineWidth = this.options.strokeWidth;
	this.ctx.textBaseline = 'top';
	this.ctx.fillRect(0, 0, this.options.width, this.options.height);
}

A_TVCIndicator.prototype.clear = function() {
	this.ctx.fillStyle = this.options.bgColor;
	this.ctx.fillRect(0, 0, this.options.width, this.options.height);
}


A_TVCIndicator.prototype.drawOuterBox = function(x, y, width, height, radius) {
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

A_TVCIndicator.prototype.drawTitle = function() {
	this.ctx.strokeStyle = this.options.strokeColor;
	this.ctx.fillStyle = this.options.titleColor;
	this.ctx.lineWidth = this.options.strokeWidth;
	this.ctx.font = this.options.titleFontSize+"px Helvetica";
	
	let width = this.ctx.measureText(this.options.title).width;
	this.ctx.fillText(this.options.title, (this.options.width/2)-(width/2), this.options.titleTopSpacing);

	// this.ctx.beginPath();
	// this.ctx.moveTo(0, this.options.titleFontSize);
	// this.ctx.lineTo(this.options.width, this.options.titleFontSize);
	// this.ctx.stroke();
}

A_TVCIndicator.prototype.drawText = function() {
	this.ctx.strokeStyle = this.options.strokeColor;
	this.ctx.lineWidth = this.options.strokeWidth;
	this.ctx.font = this.options.dataFontSize+"px Helvetica";

	let y = this.options.titleTopSpacing+this.options.titleBottomSpacing+this.options.titleFontSize;
	let height = this.options.height-y;
	let rowDiff = height/(1+Math.floor(this.data.length/2));

	let d = this.data[0];
	this.ctx.fillStyle = d[3]?"#0f0":"#f00";
	let t = d[3]?"TVC Active":"TVC Inactive"
	let tWidth = this.ctx.measureText(t).width;
	this.ctx.fillText(t, (this.options.width/2)-(tWidth/2), y);
	y+=rowDiff;

	this.ctx.fillStyle = this.options.strokeColor;
	for (let i=1; i<this.data.length; i++) {
		let d = this.data[i];
		let t = d[1]+": "+d[3]+d[2];

		let tWidth = this.ctx.measureText(t).width;
		let x = (this.options.width/4)+((i-1)%2*this.options.width/2)-(tWidth/2); //lol im sorry about this im very tired

		this.ctx.fillText(t, x, y);
		if ((i-1)%2) y+=rowDiff;
	}
}


A_TVCIndicator.prototype.construct = function() {
	// //Fix dpi scaling
	// let dpi = window.devicePixelRatio;
	// this.canvas.setAttribute('width', +getComputedStyle(this.canvas).getPropertyValue('width').slice(0,-2) * dpi);
	// this.canvas.setAttribute('height', +getComputedStyle(this.canvas).getPropertyValue('height').slice(0,-2) * dpi);

	this.init();
	this.clear();
	this.drawOuterBox(this.options.strokeWidth, this.options.strokeWidth, this.options.width-(2*this.options.strokeWidth), this.options.height-(2*this.options.strokeWidth), 10);
	this.drawTitle();
	this.drawText();
}

A_TVCIndicator.prototype.update = function(data) {
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