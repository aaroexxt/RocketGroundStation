const RequestHandler = {
	SUCCESS: function(message) {
		if (typeof message == "undefined") {
			message = "";
		}
		return JSON.stringify({"error": false, "wait": false, "message": message});
	},
	FAILURE: function(message) {
		if (typeof message == "undefined") {
			message = "";
		}
		return JSON.stringify({"error": true, "wait": false, "message": message});
	},
	WAIT: function(message) {
		if (typeof message == "undefined") {
			message = "";
		}
		return JSON.stringify({"error": false, "wait": true, "message": message});
	}
}

module.exports = RequestHandler;