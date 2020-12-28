/*
Custom graphing library for Flight Club/rocket stuff
Written by Aaron Becker, Dec/Jan 2020

pls do not look too long at some of this code it is v cursed
*/

/*Todos:
- make plot go up instantly, but come down slowly just like in joey b video
- make it a class
- websockets
*/

var DisplayGraph = function(canvasID, opts) {
	this.canvas = document.getElementById(canvasID);
	this.ctx = this.canvas.getContext('2d');
	this.options = { //setup default opts object
		/* GRAPH OFFSETS (where it starts drawing from the edges of the canvas) */
		XAxisLeftOffset: 65, //px
		XAxisRightOffset: 25, //px
		YAxisBottomOffset: 45, //px
		YAxisTopOffset: 40, //px

		/* BASIC PARAMS (width, height, etc) */
		width: 400, //px
		height: 225, //px
		bufferTime: 5000, //ms
		fpsUpdate: 60,

		/* TICKS (graph ticks) */
		tickSize: 10, //px
		ticksX: 7,
		ticksY: 7,

		/* DRAW OPTIONS (stroke width, default color, etc) */
		strokeWidth: 1, //px
		titleFontSize: 15, //px
		axesFontSize: 12, //px
		numsFontSize: 10, //px
		bgColor: "#292824", //html color
		strokeColor: "#fff", //html color
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

	//Make sure that required properties are being passed in (we need to know what buffers to draw, colors, title etc)
	let requiredProperties = ["buffers", "colors", "title", "titleX", "titleY"];
	for (let i=0; i<requiredProperties.length; i++) {
		if (!opts.hasOwnProperty(requiredProperties[i]) || typeof opts[requiredProperties[i]] == "undefined") {
			return console.error("Missing required property in options: '"+requiredProperties[i]+"'");
		}
	}

	//Setup constants based on present required ones
	this.drawBuffers = opts.buffers;
	this.drawColors = opts.colors;
	this.titles = {
		main: opts.title,
		x: opts.titleX,
		y: opts.titleY
	}

	//Construct the actual graph (draws outside box, etc)
	this.construct();

	//Setup updating interval to redraw graph every 1/fps sec
	this.graphInterval = setInterval(() => {this.update();}, 1000/this.fpsUpdate);
}

/* FUNCTION PROTOTYPES */

//Initialize the graph; setup width, height, and fill it with blank color
DisplayGraph.prototype.init = function() {
	this.canvas.width = this.options.width;
	this.canvas.height = this.options.height;
	this.ctx.fillStyle = this.options.bgColor;
	this.ctx.textBaseline = 'top';
	this.ctx.fillRect(0, 0, this.options.width, this.options.height);
}

//Clear the graph completely (fill with background color)
DisplayGraph.prototype.clear = function() {
	this.ctx.fillStyle = this.options.bgColor;
	this.ctx.fillRect(0, 0, this.options.width, this.options.height);
}

//Clear graph area only (only active graphing area) so that title etc does not have to be withdrawn every frame
DisplayGraph.prototype.clearGraphArea = function() {
	this.ctx.fillStyle = this.options.bgColor;
	this.ctx.fillRect(this.options.XAxisLeftOffset+this.options.strokeWidth, this.options.YAxisTopOffset, this.options.width-this.options.XAxisRightOffset-this.options.XAxisLeftOffset, this.options.height-this.options.YAxisBottomOffset-this.options.YAxisTopOffset-(3*this.options.strokeWidth));
}

//Draw various axes onto the graph
DisplayGraph.prototype.drawAxes = function() {
	this.ctx.strokeStyle = this.options.strokeColor;
	this.ctx.fillStyle = this.options.strokeColor;
	this.ctx.lineWidth = this.options.strokeWidth;

	//draw x axis line
	this.ctx.beginPath();
	this.ctx.moveTo(this.options.XAxisLeftOffset, this.options.height-this.options.YAxisBottomOffset);
	this.ctx.lineTo(this.options.width-this.options.XAxisRightOffset, this.options.height-this.options.YAxisBottomOffset);
	//draw y axis line
	this.ctx.moveTo(this.options.XAxisLeftOffset, this.options.YAxisTopOffset);
	this.ctx.lineTo(this.options.XAxisLeftOffset, this.options.height-this.options.YAxisBottomOffset);
	//draw tick marks on x
	let tickDistanceX = (this.options.width-this.options.XAxisLeftOffset-this.options.XAxisRightOffset)/(this.options.ticksX-1);
	for (let i=0; i<this.options.ticksX; i++) {
		this.ctx.moveTo(this.options.XAxisLeftOffset+(i*tickDistanceX), this.options.height-this.options.YAxisBottomOffset);
		this.ctx.lineTo(this.options.XAxisLeftOffset+(i*tickDistanceX), this.options.height-this.options.YAxisBottomOffset+this.options.tickSize)
	}

	//draw tick marks on y
	let tickDistanceY = (this.options.height-this.options.YAxisBottomOffset-this.options.YAxisTopOffset)/(this.options.ticksY-1);
	for (let i=0; i<this.options.ticksY; i++) {
		this.ctx.moveTo(this.options.XAxisLeftOffset-this.options.tickSize, this.options.height-this.options.YAxisBottomOffset-(i*tickDistanceY));
		this.ctx.lineTo(this.options.XAxisLeftOffset, this.options.height-this.options.YAxisBottomOffset-(i*tickDistanceY));
	}
	this.ctx.closePath();
	this.ctx.stroke(); //actually draw it!
}

//Draw the outer box with rounded corners (no default function for this reee)
DisplayGraph.prototype.drawOuterBox = function(x, y, width, height, radius) {
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

//Draw graph titles onto canvas
DisplayGraph.prototype.drawTitles = function(title, xAxis, yAxis) {
	this.ctx.strokeStyle = this.options.strokeColor;
	this.ctx.fillStyle = this.options.strokeColor;

	this.ctx.font = this.options.titleFontSize+"px Helvetica"; //Draw main title
	let width = this.ctx.measureText(title).width;
	this.ctx.fillText(title, (this.options.width/2)-(width/2), this.options.titleFontSize);

	this.ctx.font = this.options.axesFontSize+"px Helvetica"; //Draw x axis title
	width = this.ctx.measureText(xAxis).width;
	this.ctx.fillText(xAxis, (this.options.width/2)-(width/2), this.options.height-this.options.axesFontSize-5);

	//Draw Y axis title
	this.ctx.save(); //save snapshot of context state
	width = this.ctx.measureText(yAxis).width; //measure text
	this.ctx.translate(this.options.axesFontSize-5, (this.options.height/2)+(width/2)); //translate to new pos
	this.ctx.rotate(-Math.PI/2); //rotate context 90deg
	this.ctx.fillText(yAxis, 0, 0); //stroke text
	this.ctx.restore(); //return to "normal" state
}

//Draw numbers on the X axis to correspond with the graph's range (min and max)
DisplayGraph.prototype.drawXAxisNumbers = function(min, max) {
	this.ctx.fillStyle = this.options.bgColor;
	this.ctx.fillRect(2*this.options.strokeWidth, this.options.height-this.options.YAxisBottomOffset+this.options.tickSize, this.options.width-(4*this.options.strokeWidth), this.options.numsFontSize+2)

	this.ctx.strokeStyle = this.options.strokeColor;
	this.ctx.fillStyle = this.options.strokeColor;
	this.ctx.font = this.options.numsFontSize+"px Helvetica"; //draw x axis numbers
	let tickDistanceX = (this.options.width-this.options.XAxisLeftOffset-this.options.XAxisRightOffset)/(this.options.ticksX-1);
	let unitsPerTick = (max-min)/(this.options.ticksX-1);
	for (let i=0; i<this.options.ticksX; i++) {
		let value = String((min+(unitsPerTick*i)).toFixed(1));
		let width = this.ctx.measureText(value).width;
		this.ctx.fillText(value, this.options.XAxisLeftOffset+(i*tickDistanceX)-(width/2), this.options.height-this.options.YAxisBottomOffset+this.options.numsFontSize+2);
	}
}

//Draw numbers on the Y axis to correspond with the graph's range (min and max), this will be useful for autoscaling
DisplayGraph.prototype.drawYAxisNumbers = function(min, max) {
	this.ctx.fillStyle = this.options.bgColor;
	this.ctx.fillRect(this.options.axesFontSize+10, this.options.YAxisTopOffset-(this.options.numsFontSize/2), this.options.XAxisLeftOffset-this.options.tickSize-(this.options.axesFontSize+10), this.options.height-this.options.YAxisBottomOffset-this.options.YAxisTopOffset+this.options.numsFontSize);

	this.ctx.strokeStyle = this.options.strokeColor;
	this.ctx.fillStyle = this.options.strokeColor;
	this.ctx.font = this.options.numsFontSize+"px Helvetica";
	let tickDistanceY = (this.options.height-this.options.YAxisBottomOffset-this.options.YAxisTopOffset)/(this.options.ticksY-1);
	let unitsPerTick = (max-min)/(this.options.ticksX-1);
	for (let i=0; i<this.options.ticksY; i++) {
		let value = String((min+(unitsPerTick*i)).toFixed(1));
		let width = this.ctx.measureText(value).width;

		this.ctx.fillText(value, this.options.XAxisLeftOffset-this.options.tickSize-width-3, this.options.height-this.options.YAxisBottomOffset-(i*tickDistanceY)-(this.options.numsFontSize/2));
	}
}

//This is the big boi function, it draws the various buffers onto the graph with their respective colors
DisplayGraph.prototype.drawGraph = function(buffersToDraw, colors) {
	if (buffersToDraw.length != colors.length) return; //Make sure buffers and colors are the same size
	for (let i=0; i<buffersToDraw.length; i++) {
		if (buffersToDraw[i].length == 0) return; //Make sure buffers have data in them to draw
		if (typeof colors[i] == "undefined") {
			colors[i] = this.options.strokeColor;
		}
	}

	//Find the max and min of the data in order to do autoscaling
	let bUnitMin = 0;
	let bUnitMax = 0;
	for (let b=0; b<buffersToDraw.length; b++) {
		let buffer = buffersToDraw[b];
		for (let i=0; i<buffer.length; i++) {
			if (buffer[i][0] > bUnitMax) {
				bUnitMax = buffer[i][0];
			}
			if (buffer[i][0] < bUnitMin) {
				bUnitMin = buffer[i][0];
			}
		}
	}

	//Calculate the new scaled values
	let scaledBMin = Math.min(-1.5, bUnitMin*2.25); //One tick beyond bMin or 1.5 min
	let scaledBMax = Math.max(1.5, bUnitMax*2.25); //One tick beyond bMax


	//Redraw scaled Y axis, active scaling
	this.drawYAxisNumbers(scaledBMin, scaledBMax);


	//Calculate various constants
	let graphWidth = this.options.width-this.options.XAxisRightOffset-this.options.XAxisLeftOffset-(2*this.options.strokeWidth); //px
	let graphHeight = this.options.height-this.options.YAxisBottomOffset-this.options.YAxisTopOffset-(2*this.options.strokeWidth); //px

	let pxPerMSec = graphWidth/this.options.bufferTime; //pixels per msec on x axis
	let pxPerUnit = graphHeight/(scaledBMax-scaledBMin); //pixels per unit on y axis

	let zeroPxOffset = ((scaledBMax+scaledBMin)/2)*pxPerUnit; //do NOT ask about this one (lol it's just an offset to represent how far off the center of the graph is from "zero" aka the middle of the graph)

	let midY = this.options.YAxisTopOffset+this.options.strokeWidth+(graphHeight/2); //Mid y position of graph
	let rightX = this.options.width-this.options.XAxisRightOffset; //Right x position of graph

	let bTimeMin = bTimeMax = 0;
	let setBTimes = false;

	//Actually plot the data for each buffer
	for (let b=0; b<buffersToDraw.length; b++) {
		let buffer = buffersToDraw[b];

		//Setup colors
		this.ctx.strokeStyle = colors[b];
		this.ctx.fillStyle = this.options.strokeColor;
		this.ctx.beginPath();
		//Sort buffer by time to find order of data to plot
		buffer.sort( function(a, b){
		    if(a[1] > b[1]) return 1;
		    if(a[1] < b[1]) return -1;
		    return 0;
		});
		
		if (!setBTimes) { //idk exaaactly what this does but I think it sets up the scaling constants for just the first buffer?
			bTimeMin = buffer[0][1];
			bTimeMax = buffer[buffer.length-1][1];
			setBTimes = true;
		}

		// console.log("Mid y point:"+midY+", bottom y:"+(this.options.height-this.options.YAxisBottomOffset-this.options.strokeWidth)+", height: "+graphHeight);
		// console.log("cur max point: "+(midY-buffer[buffer.length-1][0]*pxPerUnit));
		
		//Move to first point to draw
		this.ctx.moveTo(rightX-(pxPerMSec*(buffer[0][1]-bTimeMin)), midY-(pxPerUnit*buffer[0][0])+zeroPxOffset);
		//Now draw every point in the buffer
		for (let i=1; i<buffer.length; i++) {
			this.ctx.lineTo(rightX-(pxPerMSec*(buffer[i][1]-bTimeMin)), midY-(pxPerUnit*buffer[i][0])+zeroPxOffset);
		}
		this.ctx.stroke();
	}

}

//Flush all data beyond max time or sample point out of buffer
DisplayGraph.prototype.flushOldBuffers = function(buffersToFlush) {
	//first look for newest in all the buffers
	let newestTime = 0;
	for (let b = 0; b<buffersToFlush.length; b++) {
		let buffer = buffersToFlush[b];
		if (buffer.length == 0) return;
		for (let i=0; i<buffer.length; i++) {
			if (buffer[i][1] > newestTime) {
				newestTime = buffer[i][1];
			}
		}
	}

	//Filter elements out of buffer beyond time limit
	for (let b=0; b<buffersToFlush.length; b++) {
		let buffer = buffersToFlush[b];
		let finalBuffer = [];
		for (let i=0; i<buffer.length; i++) {
			let elem = buffer[i];
			if (newestTime-elem[1] <= this.options.bufferTime) {
				finalBuffer.push(elem);
			}
		}

		buffersToFlush[b] = finalBuffer;
	}

	return buffersToFlush;
}

//Generic "update" function that's run every tick (flush buffers, clear graph, draw graph)
DisplayGraph.prototype.update = function() {
	this.flushOldBuffers(this.drawBuffers);
	this.clearGraphArea();
	this.drawGraph(this.drawBuffers, this.drawColors);
}

//Construct a base graph onto the canvas
DisplayGraph.prototype.construct = function() {
	this.init();
	this.clear();
	this.drawOuterBox(this.options.strokeWidth, this.options.strokeWidth, this.options.width-(2*this.options.strokeWidth), this.options.height-(2*this.options.strokeWidth), 10);
	this.drawAxes();
	this.drawTitles(this.titles.main, this.titles.x, this.titles.y);
	this.drawXAxisNumbers(-this.options.bufferTime/1000, 0);
	this.drawYAxisNumbers(-1.5, 1.5);
}