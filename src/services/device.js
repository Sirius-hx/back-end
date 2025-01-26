import { SerialPort } from "serialport";
import { DelimiterParser } from "@serialport/parser-delimiter";
import { OPERATIONS } from "../utils/constants.js";
import { formatResponse } from "../utils/helpers.js";

let device = null, parser = null;

export async function find(manufacturer = "FTDI", baudRate = 9600, onClose) {
  const ports = await SerialPort.list();

  if (ports.length === 0) {
    return formatResponse(
      false,
      "No devices connected. Please connect a device and try again",
    );
  }

  const port = ports.find((p) =>
    p.manufacturer && p.manufacturer.includes(manufacturer)
  );

  if (!port) {
    return formatResponse(
      false,
      `No device found with manufacturer '${manufacturer}'. Are you sure that's the manufacturer?`,
    );
  }

  try {
    const deviceLoaded = await openPort(port.path, baudRate, onClose);
    if (!deviceLoaded) {
      return formatResponse(false, "Device found but not responding");
    }
  } catch (err) {
    return formatResponse(false, err);
  }

  return formatResponse(true, "Device found and opened");
}

export function loadExperiment(experiment) {
  return new Promise((resolve, reject) => {
    device.write(`${experiment}\n`, (err) => {
      if (err) {
        return reject(
          `A fatal error ocurred while loading the experiment: ${err}`,
        );
      }

      /*
       * In order to know if the experiment was loaded successfully, the device
       * will send a message with the experiment code. We listen for this message
       * and resolve the promise when it's received. If the message is not received
       * after 2 seconds, the promise will resolve with false.
       */

      const experimentLoaded = (exp) => {
        const responseFromDevice = new Promise((resolve) => {
          parser.once("data", (expCode) => resolve(expCode === exp));
        });

        const timeout = new Promise((resolve) =>
          setTimeout(() => resolve(false), 2000)
        );

        return Promise.race([responseFromDevice, timeout]);
      };

      experimentLoaded(experiment)
        .then((isLoaded) => {
          if (!isLoaded) {
            reject(
              `The experiment ${experiment} could not be loaded. Check the device`,
            );
          } else {
            resolve(
              formatResponse(
                true,
                `Experiment ${experiment} loaded successfully`,
              ),
            );
          }
        })
        .catch((error) =>
          reject(`Error while verifying experiment load: ${error}`)
        );
    });
  });
}

export function executeOperation(operation) {
  if (!Object.values(OPERATIONS).includes(operation)) {
    throw new Error(`Operation '${operation}' is not supported`);
  }

  device.write(operation, (err) => {
    if (err) {
      throw new Error(
        `A fatal error ocurred while executing the operation: ${err}`,
      );
    }
  });
}

export function openPort(portPath, bauds, onClose) {
  return new Promise((resolve, reject) => {
    device = new SerialPort({ path: portPath, baudRate: bauds }, (err) => {
      if (err) {
        console.error(`Error opening port: ${err}`);
        reset();
        return reject(`Error opening port: ${err.message}`);
      }

      parser = device.pipe(
        new DelimiterParser({ delimiter: "\r\n", encoding: "utf8" }),
      );

      /*
       * It seems like the ready-parser doesn't have a timeout option so we create a promise
       * that gets resolved after 2 seconds. If the ready event is emitted before the timer
       * resolves, the function will return true. If the timer resolves first, the function
       * will return false. This way we can know if the device is ready or not after 2 seconds
       */
      const timeout = new Promise((resolveTimeout) => {
        setTimeout(() => resolveTimeout(false), 2000);
      });

      const readyMsg = new Promise((resolveReady) => {
        parser.once(
          "data",
          (readySeq) => resolveReady(readySeq === "SIRIUS STARTED"),
        );

        parser.on("error", (errParsing) => {
          console.error(
            `An error ocurred while parsing the data: ${errParsing}`,
          );
          resolveReady(false);
        });
      });

      device.once("close", () => onClose());

      Promise.race([timeout, readyMsg])
        .then((result) => {
          if (!result) {
            reset();
            return resolve(false);
          }
          resolve(result);
        })
        .catch((error) => {
          reset();
          reject(`Error while opening port: ${error}`);
        });
    });
  });
}

export function addDataListener(callback) {
  parser.on("data", (data) => {
    if (!(data instanceof ({}).constructor)) {
      data = JSON.parse(data);
    }
    callback(data);
  });
}

export function removeDataListener() {
  parser.removeAllListeners("data");
}

export function reset() {
  if (device && device.isOpen) {
    device.close();
  }
  device = null;
  parser = null;
}
