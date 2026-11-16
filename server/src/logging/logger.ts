import pino, { type Logger } from "pino";

/** Structured JSON logger. In development, pretty-print to stderr for humans. */
export function createLogger(level: string, pretty: boolean): Logger {
  if (pretty) {
    return pino({
      level,
      transport: {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
      },
      redact: {
        paths: ["req.headers.authorization", "req.headers.cookie", "password", "token", "refreshToken", "jwtSecret"],
        censor: "[REDACTED]",
      },
    });
  }
  return pino({
    level,
    redact: {
      paths: ["req.headers.authorization", "req.headers.cookie", "password", "token", "refreshToken", "jwtSecret"],
      censor: "[REDACTED]",
    },
  });
}

export type AppLogger = Logger;
