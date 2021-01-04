/*
Buttoooonnn library
Written by Aaron Becker
*/

var A_ButtonMenu = function(canvasID, socket, opts) {
	this.canvas = document.getElementById(canvasID);
	this.ctx = this.canvas.getContext('2d');
	this.socket = socket;
	this.options = { //setup default opts object
		/* BASIC PARAMS (width, height, etc) */
		width: 350, //px
		height: 225, //px

		/* BUTTON OPTIONS */
		buttonDistance: 5, //px
		buttonEdgeDistance: 5, //px
		/* DRAW OPTIONS (stroke width, default color, etc) */
		strokeWidth: 1, //px
		titleFontSize: 30, //px (15 big)
		buttonFontSize: 18,
		bgColor: "#000", //html color
		strokeColor: "#ddd", //html color
		titleColor: "#ddd",
		
		buttons: [
			[
				["Abort", "#f00", "r-abort"]
			],
			[
				["Auto CtDnSeq Start", "#42a64e", "r-launch"]
			],
			[
				["Vehicle Check", "#272ba8", "r-vCheck"],
				["TVC Check", "#272ba8", "r-tvcCheck"],
			],
			[
				["Pyro Arm", "#fc7005" ,"r-pyroArm"],
				["Pyro Disarm", "#baab20", "r-pyroDisarm"]
			],
			[
				["Pyro1", "#c21dbf", "r-fire-1"],
				["Pyro2", "#c21dbf", "r-fire-2"],
				["Pyro3", "#c21dbf", "r-fire-3"],
				["Pyro4", "#c21dbf", "r-fire-4"],
				["Pyro5", "#c21dbf", "r-fire-5"]
			],
			[
				["SensCalib", "#1dc4bf", "r-calib"],
				["VehReset", "#1dc4bf", "r-vReset"],
				["Set LSite", "#1dc4bf", "r-setLaunch"]
			]
		],

		

		/* OTHER OPTIONS */
		title: "Control Panel"
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

	this.canvas.addEventListener("click", event => {
		if (!this.boundingBoxes) return;

		let rect = this.canvas.getBoundingClientRect();
		let posX = event.clientX-rect.left;
		let posY = event.clientY-rect.top;

		let found = evtId = false;
		for (let i=0; i<this.boundingBoxes.length; i++) {
			let r = this.boundingBoxes[i];
			if (isInsideRect(posX, posY, r[0], r[1], r[2], r[3])) {
				this.socket.emit("uiButton", r[4]); //broadcast event
				evtId = r[4];
				found = true;
				break;
			}
		}

		if (found) { //darken the button
			for (let i=0; i<this.options.buttons.length; i++) {
				let bRow = this.options.buttons[i];
				for (let j=0; j<bRow.length; j++) {
					let b = bRow[j];
					if (b[2] == evtId) { //id matches
						let originalColor = JSON.parse(JSON.stringify(b[1]));
						b[1] = pSBC(-0.4, originalColor);
						console.log(b[1])
						this.construct();

						setTimeout(() => {
							b[1] = originalColor;
							this.construct();
						},100);

						break;
					}
				}
			}
		}
	})
}

A_ButtonMenu.prototype.clear = function() {
	this.ctx.fillStyle = this.options.bgColor;
	this.ctx.fillRect(0, 0, this.options.width, this.options.height);
}


A_ButtonMenu.prototype.drawOuterBox = function(x, y, width, height, radius, fill) {
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

A_ButtonMenu.prototype.drawTitle = function() {
	this.ctx.strokeStyle = this.options.titleColor;
	this.ctx.fillStyle = this.options.titleColor;
	this.ctx.lineWidth = this.options.strokeWidth;
	this.ctx.font = this.options.titleFontSize+"px Helvetica";
	
	let width = this.ctx.measureText(this.options.title).width;
	this.ctx.fillText(this.options.title, (this.options.width/2)-(width/2), this.options.titleFontSize);

	this.ctx.beginPath();
	this.ctx.moveTo((this.options.width/2)-(width/2), this.options.titleFontSize+2);
	this.ctx.lineTo((this.options.width/2)+(width/2), this.options.titleFontSize+2);
	this.ctx.stroke();
}

A_ButtonMenu.prototype.drawButtons = function() {
	let buttonHeight = (this.options.height-(2*(this.options.strokeWidth+this.options.buttonEdgeDistance))-this.options.buttonEdgeDistance-(this.options.buttonDistance*this.options.buttons.length)-this.options.titleFontSize)/this.options.buttons.length;
	let y = this.options.strokeWidth+this.options.buttonEdgeDistance+this.options.titleFontSize+this.options.buttonEdgeDistance;
	
	this.ctx.font = "bold "+this.options.buttonFontSize+"px Helvetica";
	let boundingBoxes = [];
	for (let i=0; i<this.options.buttons.length; i++) {
		let bRow = this.options.buttons[i];

		let x = this.options.buttonEdgeDistance+this.options.strokeWidth;
		let bWidth = (this.options.width-(2*(this.options.buttonEdgeDistance+this.options.strokeWidth))-(bRow.length*this.options.buttonDistance))/bRow.length;
		for (let j=0; j<bRow.length; j++) {
			let b = bRow[j];
			this.ctx.fillStyle = b[1];
			this.drawOuterBox(x, y, bWidth, buttonHeight, 5, true);

			let rgb = hexToRgb(b[1]);
			let brightness = Math.round(((rgb.r * 299) + (rgb.g * 587) + (rgb.b * 114)) / 1000);
			this.ctx.fillStyle = (brightness > 125) ? "#000" : "#fff";
			let width = this.ctx.measureText(b[0]).width;
			this.ctx.fillText(b[0], x+(bWidth/2)-(width/2), y+(buttonHeight/2)+(this.options.buttonFontSize/2));

			boundingBoxes.push([x, y, bWidth, buttonHeight, b[2]]);
			x+=bWidth+this.options.buttonDistance;
		}

		y+= buttonHeight+this.options.buttonDistance;
	}

	this.boundingBoxes = boundingBoxes;
}

A_ButtonMenu.prototype.construct = function() {
	//setup canvas
	this.ctx.textBaseline = 'top';
	this.canvas.width = this.options.width;
	this.canvas.height = this.options.height;

	// //Fix dpi scaling
	// let dpi = window.devicePixelRatio;
	// this.canvas.setAttribute('width', +getComputedStyle(this.canvas).getPropertyValue('width').slice(0,-2) * dpi);
	// this.canvas.setAttribute('height', +getComputedStyle(this.canvas).getPropertyValue('height').slice(0,-2) * dpi);

	this.clear();
	this.ctx.strokeStyle = this.options.strokeColor;
	this.ctx.fillStyle = this.options.strokeColor;
	this.ctx.lineWidth = this.options.strokeWidth;
	this.drawOuterBox(this.options.strokeWidth, this.options.strokeWidth, this.options.width-(2*this.options.strokeWidth), this.options.height-(2*this.options.strokeWidth), 10);
	this.drawTitle();
	this.drawButtons();
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

function isInsideRect (posX, posY, rectX, rectY, rectW, rectH) {
    return posX > rectX && posX < rectX+rectW && posY < rectY+rectH && posY > rectY
}

// Magic color blending function from https://stackoverflow.com/questions/5560248/programmatically-lighten-or-darken-a-hex-color-or-rgb-and-blend-colors
const pSBC=(p,c0,c1,l)=>{
    let r,g,b,P,f,t,h,i=parseInt,m=Math.round,a=typeof(c1)=="string";
    if(typeof(p)!="number"||p<-1||p>1||typeof(c0)!="string"||(c0[0]!='r'&&c0[0]!='#')||(c1&&!a))return null;
    if(!this.pSBCr)this.pSBCr=(d)=>{
        let n=d.length,x={};
        if(n>9){
            [r,g,b,a]=d=d.split(","),n=d.length;
            if(n<3||n>4)return null;
            x.r=i(r[3]=="a"?r.slice(5):r.slice(4)),x.g=i(g),x.b=i(b),x.a=a?parseFloat(a):-1
        }else{
            if(n==8||n==6||n<4)return null;
            if(n<6)d="#"+d[1]+d[1]+d[2]+d[2]+d[3]+d[3]+(n>4?d[4]+d[4]:"");
            d=i(d.slice(1),16);
            if(n==9||n==5)x.r=d>>24&255,x.g=d>>16&255,x.b=d>>8&255,x.a=m((d&255)/0.255)/1000;
            else x.r=d>>16,x.g=d>>8&255,x.b=d&255,x.a=-1
        }return x};
    h=c0.length>9,h=a?c1.length>9?true:c1=="c"?!h:false:h,f=this.pSBCr(c0),P=p<0,t=c1&&c1!="c"?this.pSBCr(c1):P?{r:0,g:0,b:0,a:-1}:{r:255,g:255,b:255,a:-1},p=P?p*-1:p,P=1-p;
    if(!f||!t)return null;
    if(l)r=m(P*f.r+p*t.r),g=m(P*f.g+p*t.g),b=m(P*f.b+p*t.b);
    else r=m((P*f.r**2+p*t.r**2)**0.5),g=m((P*f.g**2+p*t.g**2)**0.5),b=m((P*f.b**2+p*t.b**2)**0.5);
    a=f.a,t=t.a,f=a>=0||t>=0,a=f?a<0?t:t<0?a:a*P+t*p:0;
    if(h)return"rgb"+(f?"a(":"(")+r+","+g+","+b+(f?","+m(a*1000)/1000:"")+")";
    else return"#"+(4294967296+r*16777216+g*65536+b*256+(f?m(a*255):0)).toString(16).slice(1,f?undefined:-2)
}