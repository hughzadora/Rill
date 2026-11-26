import { serve } from "bun";
import { readConfiguration } from "./adapters/configuration";
import { handleRequest } from "./adapters/http";

const { PORT } = readConfiguration(process.env.PORT);
const server = serve({ hostname: "127.0.0.1", port: PORT, fetch: handleRequest });
console.log(`Reservation quote API listening at ${String(server.url)}`);
