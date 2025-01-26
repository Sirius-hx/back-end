import handleTestEvent from "@/routes/dev/handlers.js";
import handleEvent from "@/routes/prod/handlers.js";
import { reset } from "@/services/device.js";
import { EVENTS } from "constants";

/*
 * This function sets up the routes for the server. Since the server is using socket.io,
 * the concept of 'endpoints' refers to events that the socket listens to. Since the library offers
 * the namespaces functionality, we support the same endpoints, but for a production namespace - which requires a device
 * connected - and a development environment - which does not require a device connected and all is mocked.
 */
export default function setupRouter(server) {
  const productionNs = server.io.of("/api/production");
  const developmentNs = server.io.of("/api/development");

  [productionNs, developmentNs].forEach((ns) => {
    ns.on("connection", (socket) => {
      const isDevEnv = ns.name === "/api/development";

      Object.values(EVENTS).forEach((event) => {
        socket.on(event, async (data) => {
          if (isDevEnv) {
            await handleTestEvent(event, data, socket);
          } else {
            await handleEvent(event, data, socket);
          }
        });
      });

      // In case the client disconnects, we reset the state of the device
      socket.on("disconnect", () => reset());
    });
  });
}
