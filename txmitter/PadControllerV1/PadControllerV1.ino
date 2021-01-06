#include <SPI.h>
#include <RH_RF95.h>
#include "states.h"
#include "pindefs.h"
#include <Arduino.h>
#include <U8g2lib.h>

#ifdef U8X8_HAVE_HW_SPI
#include <SPI.h>
#endif
#ifdef U8X8_HAVE_HW_I2C
#include <Wire.h>
#endif

/*
DISPLAY
*/

U8G2_ST7565_NHD_C12832_F_4W_HW_SPI u8g2(U8G2_R0, /* cs=*/ 9, /* dc=*/ 5, /* reset=*/ 10);
long lastDisplayUpdateTime = 0;
const int displayUpdateDelay = 500;

/*
RADIO
*/
RH_RF95 radio(RADIO_CS, RADIO_IRQ);

struct RadioPacket {
	uint8_t id;
	uint8_t subID;
	float data1;
	float data2;
	float data3;
};

const byte radioQueueLength = 25;
RadioPacket radioPacketQueue[radioQueueLength];
unsigned long lastRadioSendTime = 0;
byte radioStackPos = 0;
#define RADIO_DELAY 100

/*
Radio Command List
0: Ping/pong check (heartbeat)
1: GetRocketState
2: SetRocketState
3: RocketTelem
sub IDs:
	0 - time since startup, MET, loop freq
	1 - flightmode, pyrostates, chutestates
	2 - dataloggingstates, telemsendstates, telemconnstates
	3 - battv, servov, rollmotorv
	4 - boardtemp, gpsfix, gpssats
	5 - gyro x, y, z
	6 - acc x, y, z
	7 - mag x, y, z
	8 - gnss lat, gnss lon, alt
	9 - ori x, y, z
	10 - pos x, y, z
	11 - vel x, y, z
	12 - pyro1 cont, pyro2 cont, pyro3 cont
	13 - pyro4 cont, pyro5 cont, blank
	14 - pyro1 fire, pyro2 fire, pyro3 fire
	15 - pyro4 fire, pyro5 fire, blank	
	16 - tvc x, tvc y, blank
4: RequestRocketTelem
5: Enable/Disable Pyros
6: FirePyro
*/

typedef enum {
	HEARTBEAT = 0,
	GETSTATE = 1,
	SETSTATE = 2,
	GETTELEM = 3,
	REQTELEM = 4,
	PYROARMING = 5,
	FIREPYRO = 6
} RadioCommands;

unsigned long lastRadioRecieveTime = 0;


/*
TELEMETRY STRUCT
*/

struct TELEMETRY {
	//Raw vehicle information
	unsigned long timeSinceStartup;
	unsigned long missionElapsedTime;
	double guidanceFrequency;

	//State stuff
	FlightMode fMode;
	PyroStates pState;
	ChuteStates cState;
	DataLoggingStates dState;
	TelemSendStates tSState;
	TelemConnStates tCState;

	//Basic sensor data
	float battV;
	float servoV;
	float rollMotorV;
	float boardTemp;

	//Raw sensor data
	double gyroX;
	double gyroY;
	double gyroZ;
	double accX;
	double accY;
	double accZ;
	double magX;
	double magY;
	double magZ;
	double GNSSLat;
	double GNSSLon;
	double alt;

	//Calculated state vector data
	double oriX;
	double oriY;
	double oriZ;
	double posX;
	double posY;
	double posZ;
	double velX;
	double velY;
	double velZ;

	//TVC Data
	double tvcX;
	double tvcY;
	
	//GNSS locking data
	byte gpsFix;
	int gpsSats;

	//Pyro channel data
	bool pyro1Cont;
	bool pyro2Cont;
	bool pyro3Cont;
	bool pyro4Cont;
	bool pyro5Cont;
	bool pyro1Fire;
	bool pyro2Fire;
	bool pyro3Fire;
	bool pyro4Fire;
	bool pyro5Fire;
};
struct TELEMETRY telem;


int rocketHBPacketCount = 0;
unsigned long lastPacketPrint = 0;
const int packetPrintDelay = 1000;

unsigned long lastHeartbeat = 0;
const int heartbeatDelay = 100;

String serialBuffer = "";

void setup() {

	Serial.begin(115200);
	//Setup pin states
	pinMode(IND_R_PIN, OUTPUT);
	pinMode(IND_G_PIN, OUTPUT);
	pinMode(IND_B_PIN, OUTPUT);
	pinMode(BUZZER_PIN, OUTPUT);

	analogWrite(IND_B_PIN, 55);

	int t = 1400;
	for (int i=0; i<3; i++) {
		tone(BUZZER_PIN, t);
		t+=200;
		delay(100);
	}
	noTone(BUZZER_PIN);

	bool error = false;
	if (!radio.init()) {
		error = true;
	}
	radio.setTxPower(23, false);
  	radio.setFrequency(868);

  	if (!u8g2.begin()) {
  		error = true;
  	}
  	u8g2.setFontMode(1);
  	u8g2.setFlipMode(1);

  	if (error) {
  		analogWrite(IND_G_PIN, 0);
  		analogWrite(IND_R_PIN, 55);
  		analogWrite(IND_B_PIN, 0);
  		while(1);
  	} else {
  		analogWrite(IND_G_PIN, 55);
  		analogWrite(IND_R_PIN, 0);
  		analogWrite(IND_B_PIN, 0);
  	}
  	delay(1000);
}

float packetRate;
int rssi;
bool confirmLaunch = false;

bool sendLaunch = false;
unsigned long launchStartTime = 0;

void loop() {
	unsigned long currentMillis = millis();

	if (currentMillis - lastPacketPrint >= packetPrintDelay) {
		packetRate = rocketHBPacketCount/(packetPrintDelay/1000);
		rssi = (int)radio.lastRssi();
		int rValue = map(packetRate, 0, 5, 64, 0);
		int gValue = map(packetRate, 0, 5, 0, 64);
		analogWrite(IND_G_PIN, gValue);
		analogWrite(IND_R_PIN, rValue);

		Serial.print("Rate=");
		Serial.print(packetRate);
		Serial.print("Hz\tRSSI=");
		Serial.println(rssi, DEC);

		rocketHBPacketCount = 0;
		lastPacketPrint = currentMillis;
	}

	if (currentMillis - lastDisplayUpdateTime >= displayUpdateDelay) {
		u8g2.clearBuffer();

		//Write TLM rate
		u8g2.setFont(u8g2_font_helvR08_tf);
		u8g2.setCursor(0,8);
    	u8g2.print("TLM Hz");
    	u8g2.setCursor(0,32);
    	u8g2.setFont(u8g2_font_logisoso16_tf);
    	u8g2.print(packetRate);

    	//Write rssi
    	u8g2.setFont(u8g2_font_helvR08_tf);
		u8g2.setCursor(40,8);
    	u8g2.print("RSSI");
    	u8g2.setCursor(40,32);
    	u8g2.setFont(u8g2_font_logisoso16_tf);
    	u8g2.print(rssi);

    	//Write pyro states
    	u8g2.setFont(u8g2_font_helvR08_tf);
		u8g2.setCursor(70,32);
    	u8g2.print("Cont=");
    	u8g2.print((telem.pyro1Cont)?"T":"F");
    	u8g2.print((telem.pyro2Cont)?"T":"F");
    	u8g2.print((telem.pyro3Cont)?"T":"F");
    	u8g2.print((telem.pyro4Cont)?"T":"F");
    	u8g2.print((telem.pyro5Cont)?"T":"F");

    	//Write voltage rails
    	u8g2.setFont(u8g2_font_helvR08_tf);
		u8g2.setCursor(70,8);
    	u8g2.print("V=");
    	u8g2.print(telem.battV);
    	u8g2.print(",");
    	u8g2.print(telem.servoV);

    	//Write altitude
    	u8g2.setFont(u8g2_font_helvR08_tf);
		u8g2.setCursor(70,20);
    	u8g2.print("Alt=");
    	u8g2.print(telem.alt);

    	u8g2.sendBuffer();

    	lastDisplayUpdateTime = currentMillis;
	}

	if (currentMillis - lastHeartbeat > heartbeatDelay) {
		addRadioPacketToQueue(HEARTBEAT, 0, 0, 0, 0);
		lastHeartbeat = currentMillis;
	}

	if (Serial.available() > 0) {
		char inChar = Serial.read();

		if (inChar == ';') {
			serialBuffer.toLowerCase().trim();

			Serial.print("Got command: ");
			Serial.println(serialBuffer);
			if (serialBuffer == "getstate") {
				addRadioPacketToQueue(GETSTATE, 0, 0, 0, 0);
			} else if (serialBuffer == "pyroarm") {
				addRadioPacketToQueue(PYROARMING, 0, 1, 0, 0);
			} else if (serialBuffer == "pyrodisarm") {
				addRadioPacketToQueue(PYROARMING, 0, 0, 0, 0);
			} else if (serialBuffer == "stateidle") {
				addRadioPacketToQueue(SETSTATE, 0, 1, 0, 0);
			} else if (serialBuffer == "statelaunch") {
				addRadioPacketToQueue(SETSTATE, 0, 2, 0, 0);
			} else if (serialBuffer == "firepyro1") {
				addRadioPacketToQueue(FIREPYRO, 0, 1, 1000, 0);
			} else if (serialBuffer == "firepyro2") {
				addRadioPacketToQueue(FIREPYRO, 0, 2, 1000, 0);
			} else if (serialBuffer == "firepyro3") {
				addRadioPacketToQueue(FIREPYRO, 0, 3, 1000, 0);
			} else if (serialBuffer == "firepyro4") {
				addRadioPacketToQueue(FIREPYRO, 0, 4, 1000, 0);
			} else if (serialBuffer == "firepyro5") {
				addRadioPacketToQueue(FIREPYRO, 0, 5, 1000, 0);
			} else if (serialBuffer == "launch") {
				if (!confirmLaunch) { //Are we sure?
					u8g2.clearBuffer();
					u8g2.setFont(u8g2_font_logisoso22_tf);
					u8g2.setCursor(0, 30);
					u8g2.print("Confirm?");
					u8g2.sendBuffer();
					for (int i=0; i<3; i++) {
						tone(BUZZER_PIN, 1400);
						delay(100);
						tone(BUZZER_PIN, 1700);
						delay(100);
					}
					noTone(BUZZER_PIN);
					delay(2000);
					confirmLaunch = true;
				} else { //WE ARE CONFIRMED! Go for it!
					u8g2.clearBuffer();
					u8g2.setFont(u8g2_font_logisoso16_tf);
					u8g2.setCursor(0, 30);
					u8g2.print("Confirmed :)");
					u8g2.sendBuffer();
					
					delay(1000);
					confirmLaunch = false; //reset flag

					for (int i=10; i>0; i--) {
						u8g2.clearBuffer();
						u8g2.setCursor(55, 30);
						u8g2.print(i);
						u8g2.sendBuffer();

						if (i > 3) {
							tone(BUZZER_PIN, 1400);
							delay(100);
							noTone(BUZZER_PIN);
							delay(900);
						} else {
							for (int i=0; i<2; i++) {
								tone(BUZZER_PIN, 1400);
								delay(100);
								tone(BUZZER_PIN, 2000);
								delay(100);
							}
							noTone(BUZZER_PIN);
							delay(600);
						}
					}

					sendLaunch = true;
					launchStartTime = millis();

				}

			} else {
				Serial.println("Command not understood");
			}
			serialBuffer = "";
		} else {
			serialBuffer += inChar;
		}
	}

	if (sendLaunch) {
		delay(200);
		RadioPacket launchPacket;
		launchPacket.id = SETSTATE;
		launchPacket.data1 = 3;
		sendRadioPacket(launchPacket);
		if (millis() - launchStartTime > 5000) {
			sendLaunch = false;
		}
	}

	if (radioStackPos > 0) {
		if (millis() - lastRadioSendTime > RADIO_DELAY) {
			for (int i=1; i<radioQueueLength; i++) { //Left shift all results by 1
				radioPacketQueue[i-1] = radioPacketQueue[i];
			}
			radioStackPos--; //we've removed one from the stack
			if (radioStackPos > 0) { //is there something new to send?
				sendRadioPacket(radioPacketQueue[0]);
				lastRadioSendTime = millis();
			}
		}
	}
	if (radio.available()) {
		RadioPacket rx;
		uint8_t datalen = sizeof(rx);
		radio.recv((uint8_t*)&rx, &datalen);

		// if (rx.id != 3) {
		// 	Serial.print("GOT CMD: ");
		// 	Serial.println(rx.id);
		// }
		switch (rx.id) { //TODO copy to the phat struct
			case HEARTBEAT:
				rocketHBPacketCount++;
				break;
			case GETTELEM:
			/*
			//PACKET QUEUE IDs
			addRadioPacketToQueue(GETTELEM, 0, telem.timeSinceStartup, telem.missionElapsedTime, telem.guidanceFrequency);
			addRadioPacketToQueue(GETTELEM, 1, telem.fMode, telem.pState, telem.cState);
			addRadioPacketToQueue(GETTELEM, 2, telem.dState, telem.tSState, telem.tCState);
			addRadioPacketToQueue(GETTELEM, 3, telem.battV, telem.servoV, telem.rollMotorV);
			addRadioPacketToQueue(GETTELEM, 4, telem.boardTemp, telem.gpsFix, telem.gpsSats);

			addRadioPacketToQueue(GETTELEM, 5, telem.gyroX, telem.gyroY, telem.gyroZ);
			addRadioPacketToQueue(GETTELEM, 6, telem.accX, telem.accY, telem.accZ);
			addRadioPacketToQueue(GETTELEM, 7, telem.magX, telem.magY, telem.magZ);
			addRadioPacketToQueue(GETTELEM, 8, telem.GNSSLat, telem.GNSSLon, telem.alt);

			addRadioPacketToQueue(GETTELEM, 9, telem.oriX, telem.oriY, telem.oriZ);
			addRadioPacketToQueue(GETTELEM, 10, telem.posX, telem.posY, telem.posZ);
			addRadioPacketToQueue(GETTELEM, 11, telem.velX, telem.velY, telem.velZ);

			addRadioPacketToQueue(GETTELEM, 12, telem.pyro1Cont, telem.pyro2Cont, telem.pyro3Cont);
			addRadioPacketToQueue(GETTELEM, 13, telem.pyro4Cont, telem.pyro5Cont, 0);

			addRadioPacketToQueue(GETTELEM, 14, telem.pyro1Fire, telem.pyro2Fire, telem.pyro3Fire);
			addRadioPacketToQueue(GETTELEM, 15, telem.pyro4Fire, telem.pyro5Fire, 0);

			addRadioPacketToQueue(GETTELEM, 16, telem.tvcX, telem.tvcY, 0);
			*/
				switch (rx.subID) {
					case 1:
						telem.fMode = (FlightMode)rx.data1;
						telem.pState = (PyroStates)rx.data2;
						telem.cState = (ChuteStates)rx.data3;
						break;
					case 3:
						telem.battV = rx.data1;
						telem.servoV = rx.data2;
						telem.rollMotorV = rx.data3;
						break;
					case 9:
						telem.oriX = rx.data1;
						telem.oriY = rx.data2;
						telem.oriZ = rx.data3;
						break;
					case 12:
						telem.pyro1Cont = (rx.data1 == 1.0) ? true : false;
						telem.pyro2Cont = (rx.data2 == 1.0) ? true : false;
						telem.pyro3Cont = (rx.data3 == 1.0) ? true : false;
						break;
					case 13:
						telem.pyro4Cont = (rx.data1 == 1.0) ? true : false;
						telem.pyro5Cont = (rx.data2 == 1.0) ? true : false;
						break;
				}
				break;
			case GETSTATE:
				Serial.println("Current rocket internal state:");
				Serial.print("FlightMode= ");
				FlightMode fm = (FlightMode)rx.data1;
				if (fm == BOOTING) {
					Serial.println("Computer booting");
				} else if (fm == CONN_WAIT) {
					Serial.println("Waiting for connection to radio");
				} else if (fm == IDLE) {
					Serial.println("Idle");
				} else if (fm == LAUNCH) {
					Serial.println("Launched!");
				} else if (fm == DESCEND) {
					Serial.println("Descending");
				} else if (fm == COPYINGSD) {
					Serial.println("Copying SD data");
				} else if (fm == LANDED) {
					Serial.println("Landed!");
				}

				Serial.print("PyroState=");
				if ((PyroStates)rx.data2 == PY_ARMED) {
					Serial.println("Armed");
				} else {
					Serial.println("Disarmed");
				}

				Serial.print("TelemetryState=");
				TelemSendStates tss = (TelemSendStates)rx.data3;
				if (tss == TEL_ENABLED_5HZ) {
					Serial.println("Enabled@5Hz");
				} else if (tss == TEL_ENABLED_15HZ) {
					Serial.println("Enabled@15Hz");
				} else if (tss == TEL_ENABLED_30HZ) {
					Serial.println("Enabled@30Hz");
				} else {
					Serial.println("Disabled");
				}
				break;
		}

		lastRadioRecieveTime = millis();
	}

}


bool addRadioPacketToQueue(uint8_t id, uint8_t subID, float data1, float data2, float data3) {
	if (radioStackPos < radioQueueLength && id >= 0 && subID >= 0) {
		//Override packet in place w/ radio ID
		radioPacketQueue[radioStackPos].id = id;
		radioPacketQueue[radioStackPos].subID = subID;
		radioPacketQueue[radioStackPos].data1 = data1;
		radioPacketQueue[radioStackPos].data2 = data2;
		radioPacketQueue[radioStackPos].data3 = data3;

		radioStackPos++; //go up 1 stackpos
		if (radioStackPos == 1) {
			sendRadioPacket(radioPacketQueue[0]); //if it's the 1st one, send it
			lastRadioSendTime = millis();
		}
		return true;
	}
	return false;
}

void sendRadioPacket(RadioPacket tx) {
	radio.send((uint8_t*)&tx, sizeof(tx)); //Gotta love this cursed line of C
	radio.waitPacketSent();
	radio.waitAvailableTimeout(100); //FIXME: THIS IS A HACK THIS SHOULD NOT BE HERE
}