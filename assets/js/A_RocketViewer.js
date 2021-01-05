/*
Title library meme
Written by Aaron Becker
*/

var A_RocketViewer = function(containerID, opts) {
	this.container = document.getElementById(containerID);
	this.options = { //setup default opts object
		/* BASIC PARAMS (width, height, etc) */
		width: 350, //px
		height: 225, //px
		fps: 30,

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

	this.renderInterval = setInterval(() => {this.render();}, 1000/this.options.fpsUpdate);
}

A_RocketViewer.prototype.threeInit = function() {

	this.camera = new THREE.PerspectiveCamera( 75, this.options.width/this.options.height, 1, 10000 );
	this.camera.position.z = 1000;
	this.camera.position.x = 1000;
	this.camera.position.y = 2000;

	this.scene = new THREE.Scene();
	// this.scene.background = new THREE.Color( 0x72645b );
	// this.scene.fog = new THREE.Fog( 0x72645b, 2, 15 );
	var _this = this;

	// Ground

	const plane = new THREE.Mesh(
		new THREE.PlaneBufferGeometry( 10000, 10000 ),
		new THREE.MeshPhongMaterial( { color: 0x999999, specular: 0x101010 } )
	);
	plane.rotation.x = - Math.PI / 2;
	plane.position.y = 0;
	this.scene.add( plane );

	plane.receiveShadow = true;


	var material = new THREE.MeshPhongMaterial({
        overdraw:true,
        color: 0xfdd017,
        flatShading: true
    });

	var loader = new THREE.STLLoader();
	loader.load(this.options.stl, function ( geometry ) {
		const mesh = new THREE.Mesh( geometry, material );
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		_this.mesh = mesh;

		_this.scene.add( mesh );

		var center = new THREE.Vector3();
		mesh.geometry.computeBoundingBox();
		mesh.geometry.boundingBox.getCenter(center);
		mesh.geometry.center();
		mesh.position.copy(center);

	} );

	var directionalLight = new THREE.DirectionalLight( 0xffffff );
    directionalLight.position.x = 0; 
    directionalLight.position.y = 0; 
    directionalLight.position.z = 1; 
    directionalLight.position.normalize();
    this.scene.add( directionalLight );

    const light = new THREE.HemisphereLight( 0xB1E1FF, 0xB97A20, 0.5 ); // soft white light
	this.scene.add( light );

	// renderer

	this.renderer = new THREE.WebGLRenderer( { antialias: true} );
	this.renderer.setPixelRatio( window.devicePixelRatio );
	this.renderer.setSize(this.options.width, this.options.height);
	this.renderer.outputEncoding = THREE.sRGBEncoding;
	this.renderer.shadowMap.enabled = true;
	this.renderer.background = "#fff";


	this.renderer.shadowMap.enabled = true;

	this.controls = new THREE.OrbitControls( this.camera, this.renderer.domElement );
	this.controls.update();

	this.container.appendChild( this.renderer.domElement );
}

A_RocketViewer.prototype.construct = function() {
	// //Fix dpi scaling
	// let dpi = window.devicePixelRatio;
	// this.canvas.setAttribute('width', +getComputedStyle(this.canvas).getPropertyValue('width').slice(0,-2) * dpi);
	// this.canvas.setAttribute('height', +getComputedStyle(this.canvas).getPropertyValue('height').slice(0,-2) * dpi);

	this.container.width = this.options.width;
	this.container.height = this.options.height;

	this.threeInit();

	// this.drawOuterBox(this.options.strokeWidth, this.options.strokeWidth, this.options.width-(2*this.options.strokeWidth), this.options.height-(2*this.options.strokeWidth), 10);
	// this.drawTitle();
	// this.drawTimes();

	this.render();
}

A_RocketViewer.prototype.render = function() {

	// this.controls.update();
	this.renderer.render( this.scene, this.camera );
}

A_RocketViewer.prototype.setRotation = function(x, y, z) {
	if (!this.mesh) return;
	let f = Math.PI/180;
	this.mesh.rotation.x = x*f;
	this.mesh.rotation.y = y*f;
	this.mesh.rotation.z = z*f;
}