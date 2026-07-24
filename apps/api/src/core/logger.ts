import pino from "pino";

import { env } from "../config/env.js";

const isDev = env.nodeEnv !== "production";

const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
  "password",
  "*.password",
  "passwordHash",
  "*.passwordHash",
  "token",
  "*.token",
  "accessToken",
  "*.accessToken",
  "refreshToken",
  "*.refreshToken",
];

export const logger = pino({
  level: env.logLevel,
  redact: { censor: "[Redacted]", paths: REDACT_PATHS },
  ...(isDev && {
    transport: {
      options: {
        colorize: true,
        ignore: "pid,hostname",
        translateTime: "HH:MM:ss.l",
      },
      target: "pino-pretty",
    },
  }),
});

export function createLogger(scope: string) {
  return logger.child({ scope });
}
