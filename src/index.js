import Fastify from "fastify";
import { handleGET } from "./handleGET.js";
import { handlePOST } from "./handlePOST.js";
import { handlePUT } from "./handlePUT.js";
import { handleDELETE } from "./handleDELETE.js";
import cors from "@fastify/cors";

const fastify = Fastify({
  logger: true,
});

fastify.register(cors, {
  origin: "*", // Remplacez "*" par le domaine autorisé pour les requêtes CORS
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  credentials: true,
});
// Declare a route
await handleGET(fastify);

fastify.options("/api/v1/users", async (request, reply) => {
  reply.code(200).send();
});

await handlePOST(fastify);
await handlePUT(fastify);
await handleDELETE(fastify);

// Run the server!

const port = process.env.PORT || 3003;
const host = "RENDER" in process.env ? `0.0.0.0` : `localhost`;

fastify.listen({ host: host, port: port }, function (err, address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});
