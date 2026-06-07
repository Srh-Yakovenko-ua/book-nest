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

const isServer = typeof window === "undefined";

export async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const { init: requestInit, url } = await buildRequest(path, init);
  const res = await fetch(url, requestInit);

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

async function buildRequest(
  path: string,
  init?: RequestOptions,
): Promise<{ init: RequestInit; url: string }> {
  if (isServer) {
    const base = process.env.API_BASE_URL ?? "http://localhost:4000";
    const { cookies } = await import("next/headers");
    const cookieHeader = (await cookies()).toString();
    return {
      init: {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
          ...init?.headers,
        },
      },
      url: `${base}${path}`,
    };
  }

  return {
    init: {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    },
    url: `${env.NEXT_PUBLIC_API_BASE_URL}${path}`,
  };
}
