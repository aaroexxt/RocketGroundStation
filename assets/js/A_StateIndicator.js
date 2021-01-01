/*
State indicator lolz
Written by Aaron Becker
*/

var A_StateIndicator = function(canvasID, opts) {
	this.canvas = document.getElementById(canvasID);
	this.ctx = this.canvas.getContext('2d');
	this.options = { //setup default opts object
		/* BASIC PARAMS (width, height, etc) */
		width: 350, //px
		height: 225, //px
		fpsUpdate: 30,

		/* DRAW OPTIONS (stroke width, default color, etc) */
		strokeWidth: 1, //px
		titleFontSize: 75, //px (15 big)
		timeFontSize: 13,
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

	this.updateInterval = setInterval(() => {this.update();}, 1000/this.options.fpsUpdate);
}

A_StateIndicator.prototype.clear = function() {

}
A_StateIndicator.prototype.construct = function()