# RocketGroundStation

This software is designed to work with [Zenith](https://github.com/aaroexxt/TVCRocket), my thrust-vector controlled rocket project, for remote command and control of the vehicle.

### Features:

- (In testing) Real-time telemetry encryption (AES-256) for secure communications
- Graphing of vehicle parameters including position, velocity, and raw sensor data
- Vehicle connectivity tracking, signal strength indication
- Clear and prominent vehicle state indication
- Simple control panel with remote commands to send to vehicle

#### Todos

- Waypoint plotting
- More efficient packet transmission structure (bitfields for pyro information instead of whole bytes) 
- Better interface! There's a great example in ![Joe's latest video of Lumineer](https://www.youtube.com/watch?v=BtdsrU057Ms)

### Demos

*Most recent version, disconnected state*
![Disconnected state](https://github.com/aaroexxt/RocketGroundStation/blob/main/screenshots/disconnected.png)

*Older version, realtime 3d rendering demonstration*
![3d rendering](https://github.com/aaroexxt/RocketGroundStation/blob/main/screenshots/demo3d%20render.jpg)
