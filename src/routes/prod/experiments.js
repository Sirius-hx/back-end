export default function handleEvent(event, data, socket) {
  try {
    switch (event) {
      case "CONNECT_DEV":
        return handleConnect(data, socket);
      case "START_EXP":
        return handleStart(data, socket);
      case "PAUSE_EXP":
        return handlePause(socket);
      case "STOP_EXP":
        return handleStop(socket);
      default:
        throw new Error(`Unknown event: ${event}`);
    }
  } catch (error) {
    socket.emit("error", { status: false, message: error.message, event });
  }
}
