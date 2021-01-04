/*
Title library meme
Written by Aaron Becker
*/

var A_Title = function(canvasID, opts) {
	this.canvas = document.getElementById(canvasID);
	this.ctx = this.canvas.getContext('2d');
	this.options = { //setup default opts object
		/* BASIC PARAMS (width, height, etc) */
		width: 350, //px
		height: 225, //px
		fpsUpdate: 30,

		/* DRAW OPTIONS (stroke width, default color, etc) */
		strokeWidth: 1, //px
		titleFontSize: 100, //px (15 big)
		timeFontSize: 15,
		bgColor: "#000", //html color
		strokeColor: "#ddd", //html color
		titleColor: "#a00",

		/* OTHER OPTIONS */
		title: "A_"
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

	this.missionRunning = false;
	this.vehicleConnected = false;
	this.vehicleConnectTime = 0;
	this.missionStartTime = 0;

	this.construct();

	this.updateInterval = setInterval(() => {this.update();}, 1000/this.options.fpsUpdate);
}

A_Title.prototype.init = function() {
	this.canvas.width = this.options.width;
	this.canvas.height = this.options.height;
	this.ctx.fillStyle = this.options.bgColor;
	this.ctx.lineWidth = this.options.strokeWidth;
	this.ctx.textBaseline = 'top';
	this.ctx.fillRect(0, 0, this.options.width, this.options.height);
}

A_Title.prototype.clear = function() {
	this.ctx.fillStyle = this.options.bgColor;
	this.ctx.fillRect(0, 0, this.options.width, this.options.height);
}

A_Title.prototype.clearTimesArea = function() {
	this.ctx.fillStyle = this.options.bgColor;
	this.ctx.fillRect(this.options.strokeWidth*2, this.options.titleFontSize, this.options.width-this.options.strokeWidth*4, this.options.height-this.options.titleFontSize-this.options.strokeWidth*6);
}

A_Title.prototype.startMissionTimer = function() {
	this.missionStartTime = new Date().getTime();
	this.missionRunning = true;
}
A_Title.prototype.stopMissionTimer = function() {
	this.missionRunning = false;
}

A_Title.prototype.startConnectTimer = function() {
	this.vehicleConnectTime = new Date().getTime();
	this.vehicleConnected = true;
}
A_Title.prototype.stopConnectTimer = function() {
	this.vehicleConnected = false;
}


A_Title.prototype.drawOuterBox = function(x, y, width, height, radius) {
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

A_Title.prototype.drawTitle = function() {
	this.ctx.strokeStyle = this.options.strokeColor;
	this.ctx.fillStyle = this.options.titleColor;
	this.ctx.lineWidth = this.options.strokeWidth;
	this.ctx.font = this.options.titleFontSize+"px Helvetica";
	
	let width = this.ctx.measureText(this.options.title).width;
	this.ctx.fillText(this.options.title, (this.options.width/2)-(width/2), 0);

	// this.ctx.beginPath();
	// this.ctx.moveTo(0, this.options.titleFontSize);
	// this.ctx.lineTo(this.options.width, this.options.titleFontSize);
	// this.ctx.stroke();
}

A_Title.prototype.drawTimes = function() {
	this.ctx.strokeStyle = this.options.strokeColor;
	this.ctx.fillStyle = this.options.strokeColor;
	this.ctx.lineWidth = this.options.strokeWidth;
	this.ctx.font = this.options.timeFontSize+"px Helvetica";

	let textToDraw = [];

	//date
	let today = new Date();
	let day = today.getDate();
	let month = today.getMonth()+1; 
	let year = today.getFullYear();
	if (day < 10) {
	    day = '0' + day;
	}
	if (month < 10) {
	    month = '0' + month;
	}
	textToDraw.push("Date: "+month+"/"+day+"/"+year);

	//Local time
	let hours = today.getHours();
	hours = (hours < 10) ? '0'+hours:hours;
	let minutes = today.getMinutes();
	minutes = (minutes < 10) ? '0'+minutes:minutes;
	let seconds = today.getSeconds();
	seconds = (seconds < 10) ? '0'+seconds:seconds;
	let time = hours+":"+minutes+":"+seconds;
	let timezone = getTimezoneName(true);
	textToDraw.push("CLT: "+time+" "+timezone);

	//vehicle on time
	if (this.vehicleConnected) {
		let diff = new Date(today.getTime()-this.vehicleConnectTime);
		let ms = Math.floor((diff.getTime()%1000)%100);
		seconds = Math.floor((diff.getTime()/1000)%60);
		minutes = Math.floor((diff.getTime()/1000/60)%60);
		hours = Math.floor((diff.getTime()/1000/3600)%60);

		ms = (ms < 10) ? '0'+ms:ms;
		hours = (hours < 10) ? '0'+hours:hours;
		minutes = (minutes < 10) ? '0'+minutes:minutes;
		seconds = (seconds < 10) ? '0'+seconds:seconds;
		textToDraw.push("VOT: "+hours+":"+minutes+":"+seconds+":"+ms);
	} else {
		textToDraw.push("VOT: 00:00:00:00");
	}

	//mission timer
	if (this.missionRunning) {
		let diff = new Date(today.getTime()-this.missionStartTime);
		let ms = Math.floor((diff.getTime()%1000)%100);
		seconds = Math.floor((diff.getTime()/1000)%60);
		minutes = Math.floor((diff.getTime()/1000/60)%60);
		hours = Math.floor((diff.getTime()/1000/3600)%60);

		ms = (ms < 10) ? '0'+ms:ms;
		hours = (hours < 10) ? '0'+hours:hours;
		minutes = (minutes < 10) ? '0'+minutes:minutes;
		seconds = (seconds < 10) ? '0'+seconds:seconds;
		textToDraw.push("MET: "+hours+":"+minutes+":"+seconds+":"+ms);
	} else {
		textToDraw.push("MET: 00:00:00:00");
	}

	
	let y = this.options.titleFontSize+this.options.timeFontSize;
	let yDist = (this.options.height-this.options.titleFontSize-this.options.timeFontSize)/textToDraw.length;
	for (let i=0; i<textToDraw.length; i++) {
		let width = this.ctx.measureText(textToDraw[i]).width;
		this.ctx.fillText(textToDraw[i], (this.options.width/2)-(width/2), y);
		y+= yDist;
	}
}


A_Title.prototype.construct = function() {
	// //Fix dpi scaling
	// let dpi = window.devicePixelRatio;
	// this.canvas.setAttribute('width', +getComputedStyle(this.canvas).getPropertyValue('width').slice(0,-2) * dpi);
	// this.canvas.setAttribute('height', +getComputedStyle(this.canvas).getPropertyValue('height').slice(0,-2) * dpi);

	this.init();
	this.clear();
	this.drawOuterBox(this.options.strokeWidth, this.options.strokeWidth, this.options.width-(2*this.options.strokeWidth), this.options.height-(2*this.options.strokeWidth), 10);
	this.drawTitle();
	this.drawTimes();
}

A_Title.prototype.update = function() {
	this.clearTimesArea();
	this.drawTimes();
}


function getTimezoneName(shortName) {
  const today = new Date();
  const short = today.toLocaleDateString(undefined);
  const full = today.toLocaleDateString(undefined, { timeZoneName: (shortName)?'short':'long' });

  // Trying to remove date from the string in a locale-agnostic way
  const shortIndex = full.indexOf(short);
  if (shortIndex >= 0) {
    const trimmed = full.substring(0, shortIndex) + full.substring(shortIndex + short.length);
    
    // by this time `trimmed` should be the timezone's name with some punctuation -
    // trim it from both sides
    return trimmed.replace(/^[\s,.\-:;]+|[\s,.\-:;]+$/g, '');

  } else {
    // in some magic case when short representation of date is not present in the long one, just return the long one as a fallback, since it should contain the timezone's name
    return full;
  }
}