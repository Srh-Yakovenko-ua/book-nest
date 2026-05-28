import pino from "pino";

import { env } from "../config/env.js";

const isDev = env.nodeEnv !== "production";

export const logger = pino({
  level: env.logLevel,
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
