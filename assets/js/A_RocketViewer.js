/*
Title library meme
Written by Aaron Becker
*/

var A_RocketViewer = function(canvasID, opts) {
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
		stl: ""
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

A_RocketViewer.prototype.init = function() {
	this.canvas.width = this.options.width;
	this.canvas.height = this.options.height;
	this.ctx.fillStyle = this.options.bgColor;
	this.ctx.lineWidth = this.options.strokeWidth;
	this.ctx.textBaseline = 'top';
}

A_RocketViewer.prototype.threeInit = function() {
	this.camera = new THREE.PerspectiveCamera( 35, this.options.width/this.options.height, 1, 15 );
	this.camera.position.set( 3, 0.15, 3 );

	this.cameraTarget = new THREE.Vector3( 0, - 0.25, 0 );

	this.scene = new THREE.Scene();
	this.scene.background = new THREE.Color( 0x72645b );
	this.scene.fog = new THREE.Fog( 0x72645b, 2, 15 );
	var _this = this;

	// Ground

	const plane = new THREE.Mesh(
		new THREE.PlaneBufferGeometry( 40, 40 ),
		new THREE.MeshPhongMaterial( { color: 0x999999, specular: 0x101010 } )
	);
	plane.rotation.x = - Math.PI / 2;
	plane.position.y = - 0.5;
	this.scene.add( plane );

	plane.receiveShadow = true;


	const material = new THREE.MeshPhongMaterial( { color: 0xAAAAAA, specular: 0x111111, shininess: 200 } );

	var loader = new THREE.STLLoader();
	loader.load(this.options.stl, function ( geometry ) {

		const mesh = new THREE.Mesh( geometry, material );

		mesh.position.set( 0, - 0.37, - 0.6 );
		mesh.rotation.set( - Math.PI / 2, 0, 0 );
		mesh.scale.set( 2, 2, 2 );

		mesh.castShadow = true;
		mesh.receiveShadow = true;

		_this.scene.add( mesh );

	} );

	this.scene.add( new THREE.HemisphereLight( 0x443333, 0x111122 ) );

	this.addShadowedLight( 1, 1, 1, 0xffffff, 1.35 );
	this.addShadowedLight( 0.5, 1, - 1, 0xffaa00, 1 );
	// renderer

	renderer = new THREE.WebGLRenderer( { antialias: true, canvas: this.canvas } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize(this.options.width, this.options.height);
	renderer.outputEncoding = THREE.sRGBEncoding;

	renderer.shadowMap.enabled = true;
}

A_RocketViewer.prototype.construct = function() {
	// //Fix dpi scaling
	// let dpi = window.devicePixelRatio;
	// this.canvas.setAttribute('width', +getComputedStyle(this.canvas).getPropertyValue('width').slice(0,-2) * dpi);
	// this.canvas.setAttribute('height', +getComputedStyle(this.canvas).getPropertyValue('height').slice(0,-2) * dpi);

	this.init();

	this.threeInit();

	// this.drawOuterBox(this.options.strokeWidth, this.options.strokeWidth, this.options.width-(2*this.options.strokeWidth), this.options.height-(2*this.options.strokeWidth), 10);
	// this.drawTitle();
	// this.drawTimes();
}

A_RocketViewer.prototype.update = function() {
	this.clearTimesArea();
	this.drawTimes();
}

A_RocketViewer.prototype.addShadowedLight = function( x, y, z, color, intensity ) {

	const directionalLight = new THREE.DirectionalLight( color, intensity );
	directionalLight.position.set( x, y, z );
	this.scene.add( directionalLight );

	directionalLight.castShadow = true;

	const d = 1;
	directionalLight.shadow.camera.left = - d;
	directionalLight.shadow.camera.right = d;
	directionalLight.shadow.camera.top = d;
	directionalLight.shadow.camera.bottom = - d;

	directionalLight.shadow.camera.near = 1;
	directionalLight.shadow.camera.far = 4;

	directionalLight.shadow.bias = - 0.002;

}