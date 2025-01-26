export const EVENTS = {
  CONNECT_DEV: "connect-device",
  START_EXP: "start-experiment",
  PAUSE_EXP: "pause-experiment",
  CHANGE_EXP: "change-experiment",
};

export const DEVICE_STATES = {
  DISCONNECTED: 0,
  CONNECTED: 1,
  STREAMING: 2,
  PAUSED: 3,
  EXP_LOADED: 4,
};

export const OPERATIONS = {
  INIT: "INIT",
  PAUSE: "PAUSE",
  ESC: "ESC",
};

export const EXPERIMENTS = [
  "MRUA",
  "FreeFall",
  "MetalDetector",
  "Termometer",
];
