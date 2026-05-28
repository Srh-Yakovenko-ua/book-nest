import { z } from "zod";

import { env } from "@/lib/env";

const fieldErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
});

const apiErrorBodySchema = z.object({
  errorsMessages: z.array(fieldErrorSchema),
});

export type FieldError = z.infer<typeof fieldErrorSchema>;

export type RequestOptions = RequestInit;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors?: FieldError[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const res = await fetch(`${env.VITE_API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    try {
      const body = JSON.parse(text);
      const parsed = apiErrorBodySchema.safeParse(body);
      if (parsed.success) {
        throw new ApiError(res.status, `HTTP ${res.status}`, parsed.data.errorsMessages);
      }
    } catch (e) {
      if (e instanceof ApiError) throw e;
    }
    throw new ApiError(res.status, text || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}
