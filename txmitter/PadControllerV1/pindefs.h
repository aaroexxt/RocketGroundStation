#ifndef pindefs_h
#define pindefs_h

#include "Arduino.h"

/*
DEVICE I2C ADDRESSES
*/

#define BARO_I2C_ADDR 0x77
#define GYRO_I2C_ADDR 0x68
#define ACC_I2C_ADDR 0x18
#define MAG_I2C_ADDR 0x10
#define GPS_I2C_ADDR 0x42
#define ADC1_I2C_ADDR 0x48
#define ADC2_I2C_ADDR 0x49

/*
INDICATOR PINS
*/

#define IND_R_PIN 4
#define IND_G_PIN 3
#define IND_B_PIN 21

#define BUZZER_PIN 20

/*
PYRO PINS
*/

#define PYRO1_PIN 2
#define PYRO2_PIN 14
#define PYRO3_PIN 15
#define PYRO4_PIN 16
#define PYRO5_PIN 17

/*
TVC PINS
*/

#define TVC_X_CH1_PIN 22
#define TVC_Y_CH1_PIN 23
#define TVC_X_CH2_PIN 5
#define TVC_Y_CH2_PIN 6

/*
ROLL MOTOR PINS
*/
#define ROLL_FIN 9
#define ROLL_RIN 25

/*
SPI PINS
*/

#define SD_CS 10
#define SD_INS A12

#define RADIO_RESET 33
#define RADIO_IRQ 32
#define RADIO_CS 31

#define FLASH_CS 24

/*
IMU INTERRUPT PINS
*/
#define GYRO_INT 27
#define ACCEL_INT 28

#endif