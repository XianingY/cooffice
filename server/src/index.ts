import { buildApp } from "./app.js";
import { loadEnv } from "./config/env.js";

const env = loadEnv();
const app = await buildApp({ env });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "shutting down gracefully");
  try {
    await app.close();
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error }, "error during shutdown");
    process.exit(1);
  }
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.fatal({ err: error }, "failed to start server");
  process.exit(1);
}
