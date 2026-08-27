import { env } from "../config/env.js";

const [firstConfiguredOrigin] = env.corsOrigins;

if (firstConfiguredOrigin === undefined) {
  throw new Error("CORS_ORIGINS must configure at least one origin for tests");
}

export const TRUSTED_ORIGIN: string = firstConfiguredOrigin;
