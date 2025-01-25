import { DEVICE_STATES, EVENTS } from "constants";
import { formatResponse } from "utils";
import { clearInterval, setInterval } from "node:timers";

const { DISCONNECTED, CONNECTED, STREAMING, PAUSED, EXP_LOADED } =
  DEVICE_STATES;
const { CONNECT_DEV, START_EXP, PAUSE_EXP, CHANGE_EXP } = EVENTS;

const generators = {
  "MRUA": generateMRUAData,
  "FreeFall": generateFreeFallData,
  "Termometer": generateTermometerData,
  "MetalDetector": generateMetalDetectorData,
};

let experimentState = DISCONNECTED;
let selectedExperiment = null;
let simulationInterval = null;

export default async function handleTestEvent(event, data, socket) {
  try {
    switch (event) {
      case CONNECT_DEV:
        return handleConnect(data, socket);
      case START_EXP:
        return handleStart(socket);
      case PAUSE_EXP:
        return handlePause(socket);
      case CHANGE_EXP:
        return handleChangeExperiment(data, socket);
      default:
        socket.emit(event, {
          status: false,
          message: `Unknown event: ${event}`,
        });
    }
  } catch (error) {
    socket.emit("error", { status: false, message: error.message, event });
  }
}

function handleConnect(data, socket) {
  const { experiment } = data;
  if (!experiment) {
    return socket.emit(
      CONNECT_DEV,
      formatResponse(false, "No experiment selected"),
    );
  } else if (experimentState !== DISCONNECTED) {
    return socket.emit(
      CONNECT_DEV,
      formatResponse(false, "Device already connected"),
    );
  } else if (!generators[experiment]) {
    return socket.emit(
      CONNECT_DEV,
      formatResponse(false, "Invalid experiment selected"),
    );
  }

  experimentState = EXP_LOADED;
  selectedExperiment = experiment;
  socket.emit(
    CONNECT_DEV,
    formatResponse(
      true,
      `Device connected and experiment ${experiment} loaded`,
    ),
  );
}

function handleStart(socket) {
  if (experimentState !== EXP_LOADED && experimentState !== PAUSED) {
    return socket.emit(
      START_EXP,
      formatResponse(
        false,
        `Device ${
          experimentState === DISCONNECTED
            ? "not connected"
            : "already streaming"
        }`,
      ),
    );
  } else if (!selectedExperiment) {
    return socket.emit(
      START_EXP,
      formatResponse(
        false,
        "No experiment loaded. Please load a experiment first",
      ),
    );
  }

  try {
    startSimulation(socket, generators[selectedExperiment]);
    experimentState = STREAMING;
  } catch (error) {
    socket.emit(
      START_EXP,
      formatResponse(false, `Error starting simulation: ${error.message}`),
    );
    experimentState = CONNECTED;
  }
}

function handlePause(socket) {
  if (experimentState !== STREAMING) {
    return socket.emit(
      PAUSE_EXP,
      formatResponse(false, "No active simulation to pause"),
    );
  }

  try {
    clearInterval(simulationInterval);
    experimentState = PAUSED;
  } catch (error) {
    socket.emit(
      PAUSE_EXP,
      formatResponse(false, `Error pausing simulation: ${error.message}`),
    );
    experimentState = CONNECTED;
  }
}

function handleChangeExperiment(data, socket) {
  const { experiment } = data;

  if (experimentState === STREAMING) {
    handlePause(socket); //We can reuse the function to stop the simulation in case it's active
  }

  if (experimentState === DISCONNECTED) {
    return socket.emit(
      CHANGE_EXP,
      formatResponse(false, "Device not connected"),
    );
  } else if (!experiment) {
    return socket.emit(
      CHANGE_EXP,
      formatResponse(false, "No simulation selected for change"),
    );
  } else if (!generators[experiment]) {
    return socket.emit(
      CHANGE_EXP,
      formatResponse(false, "Invalid simultation selected for change"),
    );
  }

  experimentState = EXP_LOADED;
  selectedExperiment = experiment;

  socket.emit(
    CHANGE_EXP,
    formatResponse(true, `Simulation changed to ${experiment} successfully`),
  );
}

function startSimulation(socket, generator) {
  clearInterval(simulationInterval);

  let time = 0;
  let attempt = 1; // For FreeFall experiment

  simulationInterval = setInterval(() => {
    if (experimentState === STREAMING) {
      const data = generator(time, attempt);
      socket.emit("expData", data);
      time += 1;
      if (selectedExperiment === "FreeFall") attempt++;
    }
  }, 1000);
}

function generateMRUAData(time) {
  // Simulate uniform accelerated motion with just distance and time
  const acceleration = 2; // m/s²
  const initialVelocity = 0; // m/s
  const distance = (initialVelocity * time) +
    (0.5 * acceleration * time * time);

  return {
    MRUA: {
      time: time.toFixed(1),
      distance: distance.toFixed(2),
    },
  };
}

function generateFreeFallData(time, attempt) {
  const variation = (Math.random() - 0.5) * 0.4;
  const gravity = 9.78 + variation;

  return {
    FF: {
      attempt,
      acceleration: gravity.toFixed(2),
      error: Math.abs(((gravity - 9.78) / 9.78) * 100).toFixed(2), // Error percentage
    },
  };
}

function generateTermometerData(time) {
  const baseTemp = 25; // °C
  const variation = Math.sin(time * 0.1) * 5;

  return {
    TMT: {
      time: time.toFixed(1),
      temperature: (baseTemp + variation).toFixed(1),
    },
  };
}

function generateMetalDetectorData(time) {
  const isFerrous = Math.floor(time / 3) % 2 === 0;

  return {
    MD: {
      isFerrous: isFerrous ? 1 : 0,
    },
  };
}
