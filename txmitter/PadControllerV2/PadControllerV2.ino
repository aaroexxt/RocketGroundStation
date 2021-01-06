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

const char commandSplitChar=';';
const char commandValueChar='|';


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
	long GNSSLat;
	long GNSSLon;

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
	double tvcY;
	double tvcZ;
	bool tvcActive;

	//Roll wheel data
	float rollPercent;
	float rollSetpoint;

	//Vehicle estimation
	float twr;
	float mass;
	
	//GNSS locking data
	byte GNSSFix;
	int GNSSpDOP;
	byte GNSSSats;
	int GNSSAccHoriz; //mm
	int GNSSAccVert; //mm
	int GNSSAccVel; //mm

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
const int packetPrintDelay = 500;

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

bool outputPackets = false;

void loop() {
	unsigned long currentMillis = millis();

	if (currentMillis - lastPacketPrint >= packetPrintDelay) {
		packetRate = rocketHBPacketCount/((float)(currentMillis - lastPacketPrint)/1000.0);
		rssi = (int)radio.lastRssi();
		int rValue = map(packetRate, 0, 5, 64, 0);
		int gValue = map(packetRate, 0, 5, 0, 64);
		analogWrite(IND_G_PIN, gValue);
		analogWrite(IND_R_PIN, rValue);

		// Serial.print("Rate=");
		// Serial.print(packetRate);
		// Serial.print("Hz\tRSSI=");
		// Serial.println(rssi, DEC);

		if (outputPackets) {
			String values[] = {
				"signal="+String(rssi),
				"tlmRate="+String(packetRate)
			};

			sendCommand("vehiclePacket", values, 2);
		}

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
    	u8g2.print(telem.posX);

    	u8g2.sendBuffer();

    	lastDisplayUpdateTime = currentMillis;
	}

	if (currentMillis - lastHeartbeat > heartbeatDelay) {
		addRadioPacketToQueue(HEARTBEAT, 0, 0, 0, 0);
		lastHeartbeat = currentMillis;
	}

	if (Serial.available() > 0) {
		while (Serial.available() > 0) {
			char inChar = Serial.read();
			serialBuffer += inChar;
			if (inChar == commandSplitChar) {
				serialBuffer.trim();
				processCommand(serialBuffer); //This will recurse
				serialBuffer = "";
			}
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
		TELEMETRY tlm;
		uint8_t datalen = sizeof(tlm);
		radio.recv((uint8_t*)&tlm, &datalen);

		telem = tlm;

		if (outputPackets) {
			String pyroState = ((telem.pState==PY_ARMED)?"1":"0");
			String tvcActive = ((telem.tvcActive)?"1":"0");
			String values[] = {
				"vehicleState="+String(telem.fMode),
				"pyroState="+pyroState,

				"battV="+String(telem.battV),
				"servoV="+String(telem.servoV),
				"rollMotorV="+String(telem.rollMotorV),
				"boardTemp="+String(telem.boardTemp),

				"gyroX="+String(telem.gyroX),
				"gyroY="+String(telem.gyroY),
				"gyroZ="+String(telem.gyroZ),
				"accX="+String(telem.accX),
				"accY="+String(telem.accY),
				"accZ="+String(telem.accZ),

				"GNSSLat="+String(telem.GNSSLat),
				"GNSSLon="+String(telem.GNSSLon),

				"oriX="+String(telem.oriX),
				"oriY="+String(telem.oriY),
				"oriZ="+String(telem.oriZ),

				"posX="+String(telem.posX),
				"posY="+String(telem.posY),
				"posZ="+String(telem.posZ),

				"velX="+String(telem.velX),
				"velY="+String(telem.velY),
				"velZ="+String(telem.velZ),

				"tvcY="+String(telem.tvcY),
				"tvcZ="+String(telem.tvcZ),
				"tvcActive="+tvcActive,

				"rollPercent="+String(telem.rollPercent),
				"rollSetpoint="+String(telem.rollSetpoint),

				"twr="+String(telem.twr),
				"mass="+String(telem.mass),

				"GNSSFix="+String(telem.GNSSFix),
				"GNSSpDOP="+String(telem.GNSSpDOP),
				"GNSSSats="+String(telem.GNSSSats),
				"GNSSAccHoriz="+String(telem.GNSSAccHoriz),
				"GNSSAccVert="+String(telem.GNSSAccVert),
				"GNSSAccVel="+String(telem.GNSSAccVel),

				"pyro1Cont="+String(telem.pyro1Cont),
				"pyro2Cont="+String(telem.pyro2Cont),
				"pyro3Cont="+String(telem.pyro3Cont),
				"pyro4Cont="+String(telem.pyro4Cont),
				"pyro5Cont="+String(telem.pyro5Cont),

				"pyro1Fire="+String(telem.pyro1Fire),
				"pyro2Fire="+String(telem.pyro2Fire),
				"pyro3Fire="+String(telem.pyro3Fire),
				"pyro4Fire="+String(telem.pyro4Fire),
				"pyro5Fire="+String(telem.pyro5Fire)
			};
	        
	        sendCommand("vehiclePacket", values, 47);
	    }

		rocketHBPacketCount++;

		lastRadioRecieveTime = millis();
	}

	radio.waitAvailableTimeout(500);

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
}


void processCommand(String input) {
  if (input.indexOf(commandSplitChar)>-1) { //validate that it is a command
    //int stind = input.indexOf(commandSplitChar);
    int endind = input.indexOf(commandSplitChar);
    int valind = input.indexOf(commandValueChar);

    String command = "";
    String value = "";

    if (valind == -1) {
      command = input.substring(0,endind);
    } else {
      command = input.substring(0,valind);
      value = input.substring(valind+1,endind);
    }

    command.toLowerCase(); //conv command to lowercase

    if (command.equals("ex")) {
      Serial.print("EXIST|true;");
 	} else if (command.equals("outputenable")) {
 		outputPackets = (value == "true");
 		if (outputPackets) {
 			Serial.print("outputEnable|true;");
 		} else {
 			Serial.print("outputEnable|false;");
 		}
 	} else {
      Serial.print(F("UNC|"));
      Serial.print(command);
      Serial.print(F(";"));
    }

    input = input.substring(endind+1);
    if (input != "") { //more commands exist for us to read
      processCommand(input); //Recurse
    }
  }
}

void sendCommand(String command, String *value, uint8_t valueLen) { //can send array of values
  	// int valueLen = 0;
   //  while (value[valueLen])
   //      ++valueLen;
   //  valueLen--;
	Serial.print(command);
	if (valueLen > 0) {
		Serial.print(commandValueChar);
		for (int i=0; i<valueLen; i++) {
			Serial.print(*value);
			*value++;
			if (valueLen > 1 && (i < (valueLen-1))) {
				Serial.print(F(",")); //print comma
			}
		}
	}
	Serial.print(commandSplitChar);
}