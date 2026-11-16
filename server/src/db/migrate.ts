import { createLogger } from "../logging/logger.js";
import { openDatabase } from "./connection.js";
import { migrate } from "./migrations.js";

/** CLI entry point for running migrations before server start or deploy. */
const logger = createLogger(process.env.LOG_LEVEL ?? "info", process.env.NODE_ENV !== "production");
const databasePath = process.env.DATABASE_PATH ?? "./data/whatif.db";
const db = openDatabase(databasePath);
try {
  const applied = migrate(db);
  logger.info({ databasePath, applied }, "migrations complete");
} finally {
  db.close();
}
