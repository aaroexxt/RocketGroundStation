/*
Weird bar graph thing library
Written by Aaron Becker
*/

var A_Bar = function(canvasID, opts) {
	this.canvas = document.getElementById(canvasID);
	this.ctx = this.canvas.getContext('2d');
	this.options = { //setup default opts object

		/* BASIC PARAMS (width, height, etc) */
		x: 0,
		y: 0,
		width: 30, //px
		height: 100, //px
		horizontal: true,
		drawOuterBox: true,
		initialPaint: true,

		/* MIN/MAX */
		min: 0,
		max: 100,
		startColor: "#f00", //html color
		endColor: "#0f0", //html color

		/* OFFSETS */
		sideOffset: 2, //px

		/* DRAW OPTIONS (stroke width, default color, etc) */
		strokeWidth: 1, //px
		tickWidth: 3, //px
		fontSize: 12, //px (10 big)
		units: "V",
		title: "",
		bgColor: "#000", //html color
		strokeColor: "#ddd" //html color
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

	//By default, set horizontal var by aspect ratio (but can be overridden)
	this.options.horizontal = (this.options.width > this.options.height);

	this.startColorRGB = hexToRgb(this.options.startColor);
	this.endColorRGB = hexToRgb(this.options.endColor);

	if (this.options.initialPaint) this.update((this.options.min+this.options.max)/2)
}


A_Bar.prototype.drawOuterBox = function(x, y, width, height, radius) {
	this.ctx.strokeStyle = this.options.strokeColor;
	this.ctx.fillStyle = this.options.strokeColor;
	this.ctx.lineWidth = this.options.strokeWidth/2;

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

A_Bar.prototype.update = function(value) {
	let text = ((this.options.title!="")?this.options.title+": ":"")+String(value)+this.options.units;
	value = constrain(value, this.options.min, this.options.max); //constrain after text is made
	this.ctx.font = this.options.fontSize+"px Helvetica";
	let tWidth = this.ctx.measureText(text).width+this.options.strokeWidth*3;
	let tHeight = this.options.fontSize+this.options.strokeWidth*3;

	let twDiv2 = this.options.tickWidth/2;

	//Clear background
	this.ctx.fillStyle = this.options.bgColor;
	this.ctx.fillRect(this.options.x, this.options.y, this.options.width, this.options.height);

	//Draw background (in 1px strips)
	let color = JSON.parse(JSON.stringify(this.startColorRGB));
	if (this.options.horizontal) {
		let pxCenter = map(value, this.options.min, this.options.max, twDiv2+tWidth, this.options.width-twDiv2);
		let barWidth = (this.options.width-tWidth);

		let diff = { //difference by pixel
			r: (this.endColorRGB.r-this.startColorRGB.r)/barWidth,
			g: (this.endColorRGB.g-this.startColorRGB.g)/barWidth,
			b: (this.endColorRGB.b-this.startColorRGB.b)/barWidth
		}
		for (let i=tWidth; i<this.options.width; i++) { //fill it in 1px at a time
			this.ctx.fillStyle = rgbToHex(color.r, color.g, color.b);
			this.ctx.fillRect(i+this.options.x, this.options.sideOffset+this.options.y, 1, this.options.height-(2*this.options.sideOffset));
			color.r += diff.r;
			color.g += diff.g;
			color.b += diff.b;
		}

		if (this.options.drawOuterBox) {
			this.drawOuterBox(this.options.strokeWidth+tWidth+this.options.x, this.options.strokeWidth+this.options.y, this.options.width-(2*this.options.strokeWidth)-tWidth, this.options.height-(2*this.options.strokeWidth), 2);
		}

		this.ctx.fillStyle = this.options.strokeColor;
		this.ctx.fillRect(pxCenter-twDiv2+this.options.x, this.options.y, this.options.tickWidth, this.options.height);

		this.ctx.fillText(text, this.options.x, (this.options.height+tHeight)/2-this.options.strokeWidth+this.options.y);
	} else {
		let pxCenter = map(value, this.options.min, this.options.max, twDiv2+tHeight, this.options.height-twDiv2);

		let barHeight = (this.options.height-tHeight);
		let diff = { //difference by pixel
			r: (this.endColorRGB.r-this.startColorRGB.r)/barHeight,
			g: (this.endColorRGB.g-this.startColorRGB.g)/barHeight,
			b: (this.endColorRGB.b-this.startColorRGB.b)/barHeight
		}
		for (let i=tHeight; i<this.options.height; i++) {
			this.ctx.fillStyle = rgbToHex(color.r, color.g, color.b);
			this.ctx.fillRect(this.options.sideOffset+this.options.x, i+this.optionx.y, this.options.width-(2*this.options.sideOffset), 1);
			color.r += diff.r;
			color.g += diff.g;
			color.b += diff.b;
		}

		if (this.options.drawOuterBox) {
			this.drawOuterBox(this.options.strokeWidth+this.options.x, this.options.strokeWidth+tHeight+this.options.y, this.options.width-(2*this.options.strokeWidth), this.options.height-(2*this.options.strokeWidth)-tHeight, 2);
		}

		this.ctx.fillStyle = this.options.strokeColor;
		this.ctx.fillRect(this.options.x, pxCenter-twDiv2+this.options.y, this.options.width, this.options.tickWidth);

		this.ctx.fillText(text, (((this.options.width-tWidth)/2)+this.options.strokeWidth*2)+this.options.x, this.options.fontSize+this.options.y);
	}
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

function componentToHex(c) {
	c = constrain(c, 0, 255);
  var hex = Math.floor(c).toString(16);
  return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function map(number, in_min, in_max, out_min, out_max) {
	var val = (number - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
	return val > out_max ? out_max : val < out_min ? out_min : val;
}

function constrain(number, min, max) {
	return number > max ? max : number < min ? min : number;
}