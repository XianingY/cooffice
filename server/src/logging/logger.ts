import pino, { type Logger } from "pino";

const REDACT = {
  paths: ["req.headers.authorization", "req.headers.cookie", "password", "token", "refreshToken", "jwtSecret"],
  censor: "[REDACTED]",
};

/**
 * Structured JSON logger. In development, pretty-print to stderr for humans.
 *
 * `destination` appends JSON lines to a file instead of stdout: packaged
 * desktop apps have no attached terminal, so their logs would otherwise be
 * lost exactly when a user needs to report a problem.
 */
export function createLogger(level: string, pretty: boolean, destination?: string | null): Logger {
  if (destination) {
    return pino(
      { level, redact: REDACT },
      pino.destination({ dest: destination, mkdir: true, sync: false }),
    );
  }
  if (pretty) {
    return pino({
      level,
      transport: {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
      },
      redact: REDACT,
    });
  }
  return pino({ level, redact: REDACT });
}

export type AppLogger = Logger;
