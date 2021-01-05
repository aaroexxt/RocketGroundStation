/*
* deviceCommandQueue.js by Aaron Becker
* Implements a basic priority queueing system/command execution framework for external devices
*
* Dedicated to Marc Perkel
*
* Copyright (C) 2020, Aaron Becker <aaron.becker.developer@gmail.com>
*
*/

/*
Ideal behavior (so I can visualize response):

CLIENT 1: requests Event 1 and is looking for response 0
Server: queue empty, sends event 1 to device every 100ms, waiting for response 0
CLIENT 2: request Event 2
Server: adds event 2 to queue (pending event 1)
CLINET 1: requests Event 3
Server: adds event 3 to queue (pending event 1)
CLIENT 2: requests event 1 and is looking for response 1
Server: adds event 1 to queue (pending event 1)
Server: recieves event 1
Server: sends event 1 response to client 1 and 2
Server: proceeds to next element in queue, sends event 2 to device
ETC

Improvements:
- make it so that there is a 3x retry on each command instead of delay before timeout
- as soon as you get response you send next command so everything operates as fast as it could possibly be
*/

//When debugMode is not specified pass this in
const overrideDebugMode = true;

const debugLog = (msg, queue) => {
	if (typeof queue == "undefined") {
		queue = {
			debugMode: false,
			queueName: undefined
		}
	}
	if (!queue.debugMode) {
		return;
	}
	console.log("[DEVCMDQ"+((typeof queue.queueName != "undefined") ? ("-"+queue.queueName) : "")+"]: "+JSON.stringify(msg).replace(/\"/g,""));
}


//Modified from great Medium article: https://medium.com/@UtkarshPramodGupta/how-to-make-a-stateful-promise-in-javascript-4e08418716ad
class QueryablePromise extends Promise {
  constructor (executor) {
    super((resolve, reject) => executor(
      data => {
        resolve(data)
        this._status = 'Resolved'
      },
      err => {
        reject(err)
        this._status = 'Rejected'
      },
    ))
    this._status = 'Pending'
  }

  get status() {
    return this._status;
  }

  get isFulfilled() {
  	return (this._status == "Resolved");
  }

  get isPending() {
  	return (this._status == "Pending");
  }

  get isRejected() {
  	return (this._status == "Rejected");
  }
}

//Janky hack to allow resolving promises externally
//Modified from this cool site: http://lea.verou.me/2016/12/resolve-promises-externally-with-this-one-weird-trick/
function deferAndQuerableAndTimeout(timeout) {
	var res, rej;

	var promise = new QueryablePromise((resolve, reject) => { //Use Queryable promise to be able to resolve state externally
		res = resolve;
		rej = reject;

		if (timeout && timeout > 0) {
			debugLog("Timeout being set for "+timeout+"ms");
			setTimeout(() => {
				return reject("TIMEOUT");
			}, timeout);
		} else {
			debugLog("No timeout set; doesn't meet conditions");
		}
	});

    //Set resolve/reject functions on promise (externally resolvable/rejectable)
	promise.resolve = res;
	promise.reject = rej;

	return promise;
}

class QueueItem {
	constructor(commandToSend, lookingForResponse, strictEqCheck, timeout) {
		//Initialize stuff
		this.timeout = timeout || -1;
		this.promises = [];
		this.strictEqCheck = (typeof strictEqCheck == "undefined") ? false : strictEqCheck;

		this.commandToSend = commandToSend; //Okay if it's undefined since that's a possible case; just means it's a "listener" only and won't emit commands
		this.lookingFor = lookingForResponse;
	}

	addPromise() {
		let retPromise = deferAndQuerableAndTimeout(this.timeout);
		this.promises.push(retPromise);
		return retPromise;
	}

	checkCompletion(toMatch) {
		if (typeof this.lookingFor == "string") {
			if (this.strictEqCheck) {
				return (this.lookingFor == toMatch);
			} else {
				return (toMatch.indexOf(this.lookingFor) >= 0);
			}
		} else {
			if (toMatch.length == this.lookingFor.length) {
				for (let i=0; i<this.lookingFor.length; i++) {
					if (this.strictEqCheck) {
						if (this.lookingFor[i] != toMatch[i]) { //If any element differs
							return false;
						}
					} else {
						if (toMatch[i].indexOf(this.lookingFor[i]) < 0) { //If any element differs
							return false;
						}
					}
				}
				return true;
			} else {
				return false;
			}
		}
	}

	//Complete - QueueItem was successfully completed, remove from queue
	complete(ifFoundPassthrough) {
		ifFoundPassthrough = ifFoundPassthrough || this.lookingFor; //ifFoundPassthrough represents return data that needs to be passed through to the result handlers, if not defined just pass through the event name
		for (let i=0; i<this.promises.length; i++) {
			this.promises[i].resolve(ifFoundPassthrough);
		}
	}

	//incomplete - QueueItem had an error, remove from queue
	incomplete(ifFoundPassthrough) {
		ifFoundPassthrough = ifFoundPassthrough || this.lookingFor; //ifFoundPassthrough represents return data that needs to be passed through to the result handlers, if not defined just pass through the event name
		for (let i=0; i<this.promises.length; i++) {
			this.promises[i].reject(ifFoundPassthrough);
		}
	}
}

class DeviceQueue {
	constructor(queueName, timeout, strictEqCheck, debugMode) {
		this.queueName = queueName || "unspecified";
		this.timeout = timeout || -1;
		this.debugMode = (typeof debugMode == "undefined") ? false : debugMode;
		this.strictEqCheck = (typeof strictEqCheck == "undefined") ? false : strictEqCheck;

		console.log("Initializing new DeviceQueue with name='"+this.queueName+"', timeout='"+this.timeout+"', strictEqCheck='"+(this.strictEqCheck ? "true" : "false")+"'"+", debugMode='"+(this.debugMode ? "true" : "false")+"'");

		//Perform intialization
		this.queue = [];
	}

	checkForCompletions(lookingFor) {
		debugLog("Checking for completions w/str='"+lookingFor+"'");

		//Prune the queue tree to remove queued elements that have timed out
		this.prune(lookingFor);

		let i = 0;
		while (i < this.queue.length) {
			let elem = this.queue[i];
			if (elem.checkCompletion(lookingFor)) { //If it matches
				debugLog("Elem at idx="+i+" hit for str='"+lookingFor+"'", this);
				debugLog("Removing element at idx="+i+" because it is completed", this);
				elem.complete(lookingFor); //call complete on it w/full lookingFor string as pass through
				this.queue.splice(i, 1); //remove the element
			} else { //If we didn't find it, increment the index
				i++;
			}
		}
	}

	prune() {
		//Iterate through elements in queue list
		//Iterate through each element's promises
		//If a promise has timed out/errored out, remove it
		//If all promises have been removed, then remove the queue element

		//debugLog("Now pruning queue tree", this);
		let i = 0;
		while (i < this.queue.length) {
			let elem = this.queue[i];
			let j = 0;
			while (j < elem.promises.length) {
				if (elem.promises[j].isRejected) { //use querable property that's been added to promise
					debugLog("Pruned promise in queue idx="+i+" at promise index "+j, this);
					elem.promises.splice(j, 1); //remove the promise
				} else {
					j++;
				}
			}

			//After we've removed the rejected promises, are there any left? if not, then we should remove the element from the queue
			if (elem.promises.length == 0) {
				debugLog("Element in queue idx="+i+" has no more promises; removing it", this);
				this.removeItem(i);
			} else {
				i++;
			}
		}
	}

	removeItem(idx) {
		this.queue.splice(idx, 1); //remove the element
	}

	addItem(commandToSend, lookingFor, timeoutOverride) {
		return new Promise((resolve, reject) => {
			let lfUND = (typeof lookingFor == "undefined");
			let cmdUND = (typeof commandToSend == "undefined");
			if (lfUND && cmdUND) {
				return reject("CmdToSend and LookingFor undefined; specify at least one");
			}
			let matchType = (lfUND && !cmdUND) ? "lf" : (!lfUND && cmdUND) ? "cmd" : "both"; //determine matching type

			debugLog("AddItem called, checking queue...", this);

			let foundQueueElem = false;
			for (let i=0; i<this.queue.length; i++) {
				let queueElem = this.queue[i];
				let match;
				switch (matchType) {
					case "lf":
						match = queueElem.lookingFor == lookingFor;
						break;
					case "cmd":
						match = queueElem.commandToSend == commandToSend;
						break;
					case "both":
					default:
						match = (queueElem.lookingFor == lookingFor) && (queueElem.commandToSend == commandToSend);
						break;
				}
				if (match) { //We found a command in the list already
					foundQueueElem = true;
					debugLog("QueueElem matching lf string '"+(lookingFor||"unspecified")+"' and/or commandToSend '"+(commandToSend||"unspecified")+"' w/match type '"+matchType+"' found at idx="+i+", adding promise", this);
					queueElem.addPromise().then(resp => {
						debugLog("QueueElem returned resp "+resp, this);
						return resolve(resp);
					}).catch(err => {
						debugLog("QueueElem '"+queueElem.lookingFor+"' returned err "+err, this);
						return reject(err);
					});
					break;
				}
			}

			if (!foundQueueElem) { //It wasn't in the already existent queue list
				debugLog("No matching queueElem found, adding to command list (idx: '"+this.queue.length+"', lookingFor: '"+(lookingFor||"unspecified")+"', commandToSend: '"+(commandToSend||"unspecified")+"', strictEqCheck: '"+this.strictEqCheck+"', timeout: '"+this.timeout+"'", this);
				let newItem = new QueueItem(commandToSend, lookingFor, this.strictEqCheck, (timeoutOverride || this.timeout));
				newItem.addPromise().then(resp => {
					debugLog("QueueElem returned resp "+resp, this);
					return resolve(resp);
				}).catch(err => {
					debugLog("QueueElem '"+lookingFor+"' returned err "+err, this);
					return reject(err);
				});
				this.queue.push(newItem);
			}
		});
	}

	hasElemThatCanSendCommand() {
		this.prune(); //Prune queue

		let validLen = 0;
		for (let i=0; i<this.queue.length; i++) {
			if (typeof this.queue[i].commandToSend != "undefined") {
				validLen++;
			}
		}
		return (validLen > 0);
	}

	getTopElemWithCommand() {
		this.prune(); //Prune queue

		//Iterate thru queue
		for (let i=0; i<this.queue.length; i++) {
			if (typeof this.queue[i].commandToSend != "undefined") {
				return this.queue[i]; //if it's valid, return it
			}
		}
		return false;
	}

	queueDump() {
		console.log("***Full Queue Dump***");
		if (this.queue.length > 0) {
			for (let i=0; i<this.queue.length; i++) {
				let elem = this.queue[i];
				console.log("Idx:\t\t\t\t"+i);
				console.log("Timeout:\t\t\t"+elem.timeout);
				console.log("StrictEqCheck:\t\t\t"+elem.strictEqCheck);
				console.log("LookingFor:\t\t\t"+elem.lookingFor);
				console.log("CommandToSend:\t\t\t"+elem.commandToSend);
				console.log("Promises:");
				for (let j=0; j<elem.promises.length; j++) {
					console.log("\tIdx:\t\t\t"+j);
					console.log("\tisPending:\t\t"+elem.promises[j].isPending);
					console.log("\tisRejected:\t\t"+elem.promises[j].isRejected);
					console.log("\tisFulfilled:\t\t"+elem.promises[j].isFulfilled);
					console.log("---");
				}
				console.log("-------");
			}
		}
		console.log("-- End Full Queue Dump --");
		return;
	}
}

module.exports = DeviceQueue;


/*
Potential TODODODODODODODS?
1) Queue items now have a state to them (i.e. waiting, sending, failed, succeeded)
2) timeouts for queue events start on state change
*/

/*
//TEST CODE
var arduinoQueue = new DeviceQueue("TheTestQueue2", 10000, true);

arduinoQueue.addItem("testBoi1").then(() => {
	console.log("TestBoi1 A resolved");
}).catch(e => {
	console.log("TestBoi1 A error: "+e)
})
arduinoQueue.addItem("testBoi2").then(() => {
	console.log("TestBoi2 resolved");
}).catch(e => {
	console.log("TestBoi2 error: "+e)
})
arduinoQueue.addItem("testBoi1").then(() => {
	console.log("TestBoi1 B resolved");
}).catch(e => {
	console.log("TestBoi1 B error: "+e)
})

//console.log("Shoudl see testboi 1 A and B resolve...");
//pQueueManager.queue[0].complete();
*/