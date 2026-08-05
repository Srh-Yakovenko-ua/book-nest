import { z } from "zod";

const isProduction = process.env.NODE_ENV === "production";
const LOCAL_HOSTNAMES = new Set(["0.0.0.0", "127.0.0.1", "localhost"]);
const SAME_ORIGIN = "";

const siteUrl = z
  .string()
  .url()
  .default("http://localhost:3000")
  .refine((value) => !isProduction || !LOCAL_HOSTNAMES.has(new URL(value).hostname), {
    message: "NEXT_PUBLIC_SITE_URL must be a public origin in production, not localhost",
  });

const realtimeUrl = z
  .string()
  .default(SAME_ORIGIN)
  .refine((value) => value === SAME_ORIGIN || isPublicOrigin(value), {
    message:
      "NEXT_PUBLIC_REALTIME_URL must be empty for same origin or an absolute URL, and a non-localhost origin in production",
  });

const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().default(""),
  NEXT_PUBLIC_REALTIME_URL: realtimeUrl,
  NEXT_PUBLIC_SITE_URL: siteUrl,
});

export const env = envSchema.parse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_REALTIME_URL: process.env.NEXT_PUBLIC_REALTIME_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

function isPublicOrigin(value: string): boolean {
  const parsed = z.string().url().safeParse(value);
  if (!parsed.success) return false;
  return !isProduction || !LOCAL_HOSTNAMES.has(new URL(value).hostname);
}
