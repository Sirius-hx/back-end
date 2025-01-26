import {
  addDataListener,
  executeOperation,
  find,
  loadExperiment,
  removeDataListener,
  reset,
} from "../../services/device.js";

import {
  DEVICE_STATES,
  EVENTS,
  EXPERIMENTS,
  OPERATIONS,
} from "../../utils/constants.js";
import { formatResponse } from "../../utils/helpers.js";

const { DISCONNECTED, STREAMING, PAUSED, EXP_LOADED } = DEVICE_STATES;
const { CONNECT_DEV, START_EXP, PAUSE_EXP, CHANGE_EXP } = EVENTS;
const { INIT, PAUSE, ESC } = OPERATIONS;

let state = DISCONNECTED;
let selectedExperiment = null;

export default async function handleEvent(event, data, socket) {
  try {
    switch (event) {
      case CONNECT_DEV:
        return await handleConnect(data, socket);
      case START_EXP:
        return await handleStart(data, socket);
      case PAUSE_EXP:
        return await handlePause(socket);
      case CHANGE_EXP:
        return await handleChangeExperiment(data, socket);
    }
  } catch (error) {
    state = DISCONNECTED;
    selectedExperiment = null;
    reset();
    socket.emit("error", formatResponse(false, error));
  }
}

async function handleConnect(data, socket) {
  const { manufacturer = "FTDI", baudRate = 9600, experiment } = data;

  if (!experiment) {
    return socket.emit(
      CONNECT_DEV,
      formatResponse(false, "No experiment selected"),
    );
  } else if (state !== DISCONNECTED) {
    return socket.emit(
      CONNECT_DEV,
      formatResponse(false, "Device already connected"),
    );
  } else if (!EXPERIMENTS.includes(experiment)) {
    return socket.emit(
      CONNECT_DEV,
      formatResponse(false, "Invalid experiment selected"),
    );
  }

  // For our logic, it's an error that the device gets disconnected
  // while the programm is running so we throw an error if we detect that
  const onCloseDevice = () => {
    socket.emit(
      "error",
      formatResponse(
        false,
        "Device disconnected forcibly. Please reconnect and try again",
      ),
    );
    state = DISCONNECTED;
    selectedExperiment = null;
    reset();
  };

  try {
    const deviceFound = await find(manufacturer, baudRate, onCloseDevice);

    if (!deviceFound.success) {
      return socket.emit(CONNECT_DEV, deviceFound);
    }

    const experimentLoaded = await loadExperiment(experiment);
    if (!experimentLoaded.success) {
      return socket.emit(CONNECT_DEV, experimentLoaded);
    }
  } catch (err) {
    state = DISCONNECTED;
    selectedExperiment = null;
    reset();
    return socket.emit(CONNECT_DEV, formatResponse(false, err));
  }

  state = EXP_LOADED;
  selectedExperiment = experiment;

  socket.emit(
    CONNECT_DEV,
    formatResponse(
      true,
      `Device connected and experiment ${experiment} loaded`,
    ),
  );
}

function handleStart(data, socket) {
  if (state !== EXP_LOADED && state !== PAUSED) {
    return socket.emit(
      START_EXP,
      formatResponse(
        false,
        `Device ${
          state === DISCONNECTED ? "not connected" : "already streaming"
        }`,
      ),
    );
  } else if (!selectedExperiment) {
    return socket.emit(
      START_EXP,
      formatResponse(
        false,
        "No experiment loaded. Please load an experiment first",
      ),
    );
  }

  /*
   * The user can define a custom eventName property that will be used to emit the data. In
   * case is not provided, by default the value is equal to the selectedExperiment.
   */
  const { eventName = selectedExperiment } = data;

  try {
    executeOperation(INIT);
  } catch (err) {
    state = DISCONNECTED;
    selectedExperiment = null;
    reset();
    return socket.emit("error", formatResponse(false, err.message));
  }

  addDataListener((deviceData) => {
    if (!(deviceData instanceof ({}).constructor)) {
      return socket.emit(
        "error",
        formatResponse(
          false,
          "Data received from the device is not in JSON format",
        ),
      );
    }
    socket.emit(eventName, deviceData);
  });

  state = STREAMING;
}

function handlePause(socket) {
  if (state !== STREAMING) {
    return socket.emit(
      PAUSE_EXP,
      formatResponse(false, "No active experiment to pause"),
    );
  }

  try {
    executeOperation(PAUSE);
  } catch (err) {
    state = DISCONNECTED;
    selectedExperiment = null;
    reset();
    return socket.emit("error", formatResponse(false, err.message));
  }

  removeDataListener();
  state = PAUSED;
}

async function handleChangeExperiment(data, socket) {
  const { experiment } = data;

  if (state === STREAMING) {
    handlePause(socket);
  }

  if (state === DISCONNECTED) {
    return socket.emit(
      CHANGE_EXP,
      formatResponse(false, "Device not connected"),
    );
  } else if (!experiment) {
    return socket.emit(
      CHANGE_EXP,
      formatResponse(false, "No experiment selected for change"),
    );
  } else if (!EXPERIMENTS.includes(experiment)) {
    return socket.emit(
      CHANGE_EXP,
      formatResponse(false, "Invalid experiment selected for change"),
    );
  }

  try {
    executeOperation(ESC);
    const experimentLoaded = await loadExperiment(experiment);
    if (!experimentLoaded.success) {
      return socket.emit(CHANGE_EXP, experimentLoaded);
    }
    socket.emit(CHANGE_EXP, experimentLoaded);
  } catch (err) {
    state = DISCONNECTED;
    selectedExperiment = null;
    reset();
    return socket.emit(CHANGE_EXP, formatResponse(false, err));
  }

  state = EXP_LOADED;
  selectedExperiment = experiment;
}
