import { z } from "zod";

const isProduction = process.env.NODE_ENV === "production";
const LOCAL_HOSTNAMES = new Set(["0.0.0.0", "127.0.0.1", "localhost"]);

const siteUrl = z
  .string()
  .url()
  .default("http://localhost:3000")
  .refine((value) => !isProduction || !LOCAL_HOSTNAMES.has(new URL(value).hostname), {
    message: "NEXT_PUBLIC_SITE_URL must be a public origin in production, not localhost",
  });

const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().default(""),
  NEXT_PUBLIC_SITE_URL: siteUrl,
});

export const env = envSchema.parse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});
