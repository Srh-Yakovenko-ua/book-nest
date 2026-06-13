import type { AuthResultView, LogoutResultView } from "@app/shared";

import { request } from "@/lib/http-client";

import { AuthResultSchema, LogoutResultSchema } from "./schemas";

export async function logout(): Promise<LogoutResultView> {
  const body = await request<unknown>("/api/auth/logout", { method: "POST" });
  return LogoutResultSchema.parse(body);
}

export async function refreshSession(): Promise<AuthResultView> {
  const body = await request<unknown>("/api/auth/refresh", { method: "POST" });
  return AuthResultSchema.parse(body);
}
