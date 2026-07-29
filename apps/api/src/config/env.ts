import { config } from "dotenv";
import { z } from "zod";

config({ path: `.env.${process.env.APP_ENV ?? "local"}` });

const LOCAL_R2_ACCESS_KEY_ID = "booknest";
const LOCAL_R2_SECRET_ACCESS_KEY = "booknest_local_s3";
const LOCAL_R2_ENDPOINT = "http://127.0.0.1:9000";
const LOCAL_R2_PUBLIC_BASE_URL = "http://127.0.0.1:9000/book-nest-dev";
const LOCAL_HOST_PATTERN = /localhost|127\.0\.0\.1|0\.0\.0\.0/;
const MEDIA_CONCURRENCY_CEILING = { decode: 2, upload: 8 } as const;
const TRASH_RETENTION_DAYS_CEILING = 365;
const TRASH_RETENTION_DAYS_FLOOR = 30;

const envSchema = z
  .object({
    ACCESS_TOKEN_TTL: z.string().default("15m"),
    COOKIE_SECURE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    CORS_ORIGINS: z
      .string()
      .default("http://localhost:3000")
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
    EMAIL_VERIFICATION_TTL_MINUTES: z.coerce.number().int().positive().default(60),
    ENABLE_SWAGGER: z.enum(["true", "false"]).optional(),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    LOG_LEVEL: z.enum(["debug", "error", "info", "warn"]).default("info"),
    MAIL_FROM: z.string().default("BookNest <no-reply@book-nest.net>"),
    MEDIA_DECODE_CONCURRENCY: z.coerce
      .number()
      .int()
      .positive()
      .max(MEDIA_CONCURRENCY_CEILING.decode)
      .default(1),
    MEDIA_UPLOAD_CONCURRENCY: z.coerce
      .number()
      .int()
      .positive()
      .max(MEDIA_CONCURRENCY_CEILING.upload)
      .default(3),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    OTEL_SERVICE_NAME: z.string().default("monorepo-api"),
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),
    PORT: z.coerce.number().int().positive().default(4000),
    R2_ACCESS_KEY_ID: z.string().default(LOCAL_R2_ACCESS_KEY_ID),
    R2_BUCKET: z.string().default("book-nest-dev"),
    R2_ENDPOINT: z.string().url().default(LOCAL_R2_ENDPOINT),
    R2_FORCE_PATH_STYLE: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    R2_PUBLIC_BASE_URL: z.string().url().default(LOCAL_R2_PUBLIC_BASE_URL),
    R2_REGION: z.string().default("auto"),
    R2_SECRET_ACCESS_KEY: z.string().default(LOCAL_R2_SECRET_ACCESS_KEY),
    REDIS_URL: z.string().url().default("redis://localhost:6379"),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
    REFRESH_TOKEN_TTL_DAYS_SHORT: z.coerce.number().int().positive().default(1),
    RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
    SMTP_HOST: z.string().default("localhost"),
    SMTP_PASS: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(1025),
    SMTP_SECURE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    SMTP_USER: z.string().optional(),
    TRACING_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    TRASH_RETENTION_DAYS: z.coerce
      .number()
      .int()
      .min(TRASH_RETENTION_DAYS_FLOOR)
      .max(TRASH_RETENTION_DAYS_CEILING)
      .default(90),
    WEB_BASE_URL: z.string().url().default("http://localhost:3000"),
    WIKIDATA_CONTACT: z.string().default("book-nest/1.0 (+https://book-nest.net)"),
  })
  .superRefine((raw, ctx) => {
    if (raw.NODE_ENV !== "production") {
      return;
    }
    if (!raw.COOKIE_SECURE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "COOKIE_SECURE must be true when NODE_ENV=production",
        path: ["COOKIE_SECURE"],
      });
    }
    if (raw.R2_ACCESS_KEY_ID === LOCAL_R2_ACCESS_KEY_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "R2_ACCESS_KEY_ID must be set to a non-default value when NODE_ENV=production",
        path: ["R2_ACCESS_KEY_ID"],
      });
    }
    if (raw.R2_SECRET_ACCESS_KEY === LOCAL_R2_SECRET_ACCESS_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "R2_SECRET_ACCESS_KEY must be set to a non-default value when NODE_ENV=production",
        path: ["R2_SECRET_ACCESS_KEY"],
      });
    }
    if (LOCAL_HOST_PATTERN.test(raw.R2_ENDPOINT)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "R2_ENDPOINT must not point to localhost when NODE_ENV=production",
        path: ["R2_ENDPOINT"],
      });
    }
  })
  .transform((raw) => ({
    accessTokenTtl: raw.ACCESS_TOKEN_TTL,
    cookieSecure: raw.COOKIE_SECURE,
    corsOrigins: raw.CORS_ORIGINS,
    databaseUrl: raw.DATABASE_URL,
    emailVerificationTtlMinutes: raw.EMAIL_VERIFICATION_TTL_MINUTES,
    enableSwagger:
      raw.ENABLE_SWAGGER === undefined
        ? raw.NODE_ENV !== "production"
        : raw.ENABLE_SWAGGER === "true",
    jwtAccessSecret: raw.JWT_ACCESS_SECRET,
    jwtRefreshSecret: raw.JWT_REFRESH_SECRET,
    logLevel: raw.LOG_LEVEL,
    mailFrom: raw.MAIL_FROM,
    mediaDecodeConcurrency: raw.MEDIA_DECODE_CONCURRENCY,
    mediaUploadConcurrency: raw.MEDIA_UPLOAD_CONCURRENCY,
    nodeEnv: raw.NODE_ENV,
    otelServiceName: raw.OTEL_SERVICE_NAME,
    passwordResetTtlMinutes: raw.PASSWORD_RESET_TTL_MINUTES,
    port: raw.PORT,
    r2AccessKeyId: raw.R2_ACCESS_KEY_ID,
    r2Bucket: raw.R2_BUCKET,
    r2Endpoint: raw.R2_ENDPOINT,
    r2ForcePathStyle: raw.R2_FORCE_PATH_STYLE,
    r2PublicBaseUrl: raw.R2_PUBLIC_BASE_URL,
    r2Region: raw.R2_REGION,
    r2SecretAccessKey: raw.R2_SECRET_ACCESS_KEY,
    redisUrl: raw.REDIS_URL,
    refreshTokenTtlDays: raw.REFRESH_TOKEN_TTL_DAYS,
    refreshTokenTtlDaysShort: raw.REFRESH_TOKEN_TTL_DAYS_SHORT,
    resendCooldownSeconds: raw.RESEND_COOLDOWN_SECONDS,
    smtpHost: raw.SMTP_HOST,
    smtpPass: raw.SMTP_PASS,
    smtpPort: raw.SMTP_PORT,
    smtpSecure: raw.SMTP_SECURE,
    smtpUser: raw.SMTP_USER,
    tracingEnabled: raw.TRACING_ENABLED,
    trashRetentionDays: raw.TRASH_RETENTION_DAYS,
    trustProxy: raw.NODE_ENV === "production",
    webBaseUrl: raw.WEB_BASE_URL,
    wikidataContact: raw.WIKIDATA_CONTACT,
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
