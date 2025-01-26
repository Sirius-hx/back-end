const SIMULATIONS = {
  "MRUA": generateMRUAData,
  "FreeFall": generateFreeFallData,
  "Termometer": generateTermometerData,
  "MetalDetector": generateMetalDetectorData,
};

function generateMRUAData(time) {
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

function generateFreeFallData(_time, attempt) {
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

export default SIMULATIONS;
