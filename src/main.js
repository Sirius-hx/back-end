import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import FastifyIO from "fastify-socket.io";
import process from "process";
import setupRoutes from "./routes/router.js";

const server = Fastify({
  logger: process.env.NODE_ENV === "development",
});

server.register(fastifyCors, {
  origin: process.env.CORS_ORIGIN,
});

server.register(FastifyIO, {
  cors: {
    origin: process.env.CORS_ORIGIN,
  },
  transports: ["websocket", "polling"],
});

server.ready().then(() => {
  setupRoutes(server);
});

server.listen(
  { port: process.env.PORT || 3000, host: process.env.ADDRESS },
  (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Server listening at ${address}`);
  },
);
