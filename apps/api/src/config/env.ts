import "dotenv/config";
import { z } from "zod";

const envSchema = z
  .object({
    CORS_ORIGINS: z
      .string()
      .default("http://localhost:5173")
      .transform((value, ctx) => {
        const items = value
          .split(",")
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0);
        if (items.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "CORS_ORIGINS must contain at least one origin",
          });
          return z.NEVER;
        }
        for (const item of items) {
          const result = z.string().url().safeParse(item);
          if (!result.success) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `CORS_ORIGINS contains invalid URL: ${item}`,
            });
            return z.NEVER;
          }
        }
        return items;
      }),
    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url().optional(),
    ENABLE_SWAGGER: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    LOG_LEVEL: z.enum(["debug", "error", "info", "warn"]).default("info"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    TRACING_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  })
  .transform((raw) => ({
    corsOrigins: raw.CORS_ORIGINS,
    databaseUrl: raw.DATABASE_URL,
    directUrl: raw.DIRECT_URL,
    enableSwagger: raw.ENABLE_SWAGGER,
    logLevel: raw.LOG_LEVEL,
    nodeEnv: raw.NODE_ENV,
    port: raw.PORT,
    tracingEnabled: raw.TRACING_ENABLED,
  }));

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const fieldErrors = parsed.error.flatten().fieldErrors;
  console.error("\n[env] Invalid environment variables:\n");
  for (const [key, messages] of Object.entries(fieldErrors)) {
    console.error(`  ${key}: ${messages?.join(", ")}`);
  }
  console.error("\nSee apps/api/.env.example for the expected shape.\n");
  process.exit(1);
}

export const env = parsed.data;
