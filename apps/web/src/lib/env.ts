import { z } from "zod";

const envSchema = z.object({
  MODE: z.string().default("development"),
  VITE_API_BASE_URL: z.string().default(""),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  const fieldErrors = parsed.error.flatten().fieldErrors;
  const summary = Object.entries(fieldErrors)
    .map(([key, messages]) => `  ${key}: ${messages?.join(", ")}`)
    .join("\n");

  const message = `Invalid environment variables:\n\n${summary}\n\nSee apps/web/.env.example for the expected shape.`;

  if (typeof document !== "undefined") {
    document.body.innerHTML = `<pre style="padding:2rem;font-family:ui-monospace,monospace;color:#f43f5e;white-space:pre-wrap">${message}</pre>`;
  }

  throw new Error(message);
}

export const env = parsed.data;
