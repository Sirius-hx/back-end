import { SerialPort } from "npm:serialport";
import { ReadyParser } from "npm:@serialport/parser-ready";
import { setTimeout } from "node:timers";
import { DEVICE_STATES, OPERATIONS } from "constants";
import { formatResponse } from "utils";

const { CONNECTED, STREAMING, PAUSED } = DEVICE_STATES;
const { INIT, PAUSE, ESC } = OPERATIONS;

let device = null, parser = null;

export async function find(
  manufacturer = "FTDI",
  baudRate = 9600,
  onClose,
) {
  const ports = await SerialPort.list();

  if (ports.length == 0) {
    return formatResponse(
      false,
      "No devices connected. Please connect a device and try again",
    );
  }

  const port = ports.find((port) =>
    port.manufacturer && port.manufacturer.includes(manufacturer)
  );

  if (!port) {
    return formatResponse(
      false,
      `No device found with manufacturer '${manufacturer}'. Are you sure that's the manufacturer?`,
    );
  }

  const deviceLoaded = await openPort(port.path, baudRate, onClose);

  if (!deviceLoaded) {
    return formatResponse(
      false,
      "Device found but not responding. Please check the device and try again",
    );
  }

  return formatResponse(deviceLoaded, "Device found and opened");
}

export async function loadExperiment(experiment) {
  device.write(experiment, (err) => {
    if (err) {
      throw new Error(
        `A fatal error ocurred while loading the experiment: ${err}`,
      );
    }
  });

  const experimentLoaded = (experiment) => {
    /*
     * In order to know if the experiment was loaded successfully, the device
     * will send a message with the experiment code. We listen for this message
     * and resolve the promise when it's received. If the message is not received
     * after 2 seconds, the promise will resolve with false.
     */
    const responseFromDevice = new Promise((resolve) => {
      parser.once("data", (expCode) => resolve(expCode == experiment));
    });

    const timeout = new Promise((resolve) =>
      setTimeout(() => resolve(false), 2000)
    );

    return Promise.race[responseFromDevice, timeout];
  };

  const isLoaded = await experimentLoaded(experiment);

  if (!isLoaded) {
    throw new Error(
      `The experiment ${experiment} could not be loaded. Check the device`,
    );
  }

  return formatResponse(
    isLoaded,
    `Experiment ${experiment} loaded successfully`,
  );
}

export function executeOperation(operation) {
  if (!(operation in OPERATIONS)) {
    return formatResponse(false, `Operation '${operation}' is not supported`);
  }

  device.write(operation, (err) => {
    if (err) {
      throw new Error(
        `A fatal error ocurred while executing the operation: ${err}`,
      );
    }
  });

  switch (operation) {
    case INIT:
      state = STREAMING;
      break;

    case PAUSE:
      state = PAUSED;
      break;

    case ESC:
      state = CONNECTED;
      break;
  }
}

export function openPort(portPath, bauds, onClose) {
  device = new SerialPort({ path: portPath, baudRate: bauds });

  parser = device.pipe(new ReadyParser({ delimiter: "SIRIUS STARTED" }));

  /*
   * It seems like the ready-parser doesn't have a timeout option so we create a promise
   * that gets resolved after 2 seconds. If the ready event is emitted before the timer
   * resolves, the function will return true. If the timer resolves first, the function
   * will return false. This way we can know if the device is ready or not after 2 seconds
   */

  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve(false), 2000);
  });

  const readyMsg = new Promise((resolve) => {
    parser.on("ready", () => resolve(true));

    parser.on("error", (err) => {
      throw new Error(`An error ocurred while parsing the data: ${err}`);
    });
  });

  device.once("close", () => onClose());

  return Promise.race([timeout, readyMsg]);
}

export function addDataListener(callback) {
  parser.on("data", callback);
}

export function removeDataListener(callback) {
  parser.removeListener("data", callback);
}

export function reset() {
  device = null;
  parser = null;
}
