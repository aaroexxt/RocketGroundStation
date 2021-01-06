#ifndef states_h
#define states_h

#include "Arduino.h"

enum FlightMode {
	BOOTING,
	CONN_WAIT,
	IDLE,
	LAUNCH,
	DESCEND,
	COPYINGSD,
	LANDED
};


enum PyroStates {
	PY_ARMED,
	PY_DISARMED
};


enum ChuteStates {
	C_ARMED,
	C_DISARMED,
	C_DEPLOYED
};


enum DataLoggingStates {
	DL_ENABLED_40HZ,
	DL_ENABLED_20HZ,
	DL_ENABLED_10HZ,
	DL_ENABLED_5HZ,
	DL_DISABLED
};


enum TelemSendStates {
	TEL_ENABLED_30HZ,
	TEL_ENABLED_15HZ,
	TEL_ENABLED_5HZ,
	TEL_DISABLED
};


enum TelemConnStates {
	TEL_CONNECTED,
	TEL_DISCONNECTED
};


#endif