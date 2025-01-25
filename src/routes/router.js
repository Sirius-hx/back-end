import handleTestEvent from "@/routes/dev/mocked_experiments.js"; 
import handleEvent from "@/routes/prod/experiments.js";
import { EVENTS } from "constants";

/*
 * This functions sets up the routes for the server. Since the server is using socket.io,
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
          if (isDevEnv)
            await handleTestEvent(event, data, socket);
          else
            console.log("Client connected to production namespace");

        });

      });

      socket.on("disconnect", () => {
        console.log("Client disconnected");
      });
    });
  });
}
