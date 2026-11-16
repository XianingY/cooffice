import { loadEnv } from "../config/env.js";
import { openDatabase } from "./connection.js";
import { migrate } from "./migrations.js";
import { hashPassword } from "../modules/auth/password.js";
import { UserRepository } from "../modules/auth/userRepository.js";

/** Optional dev seed: create an admin using an env-provided password.
 * Never ships with a default password; refuse to run without one. */
const password = process.env.SEED_ADMIN_PASSWORD;
if (!password || password.length < 12) {
  throw new Error("SEED_ADMIN_PASSWORD must be set with at least 12 characters");
}

const env = loadEnv();
const db = openDatabase(env.DATABASE_PATH);
try {
  migrate(db);
  const users = new UserRepository(db);
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@example.test";
  const existing = users.findByEmail(email);
  if (existing) {
    console.log(`Seed skipped: ${email} already exists`);
  } else {
    const user = users.create({
      email,
      passwordHash: await hashPassword(password),
      displayName: "Demo Admin",
      role: "admin",
    });
    console.log(`Seeded admin: ${user.email} (role=${user.role})`);
  }
} finally {
  db.close();
}
