import type { AuthResultView, LogoutResultView } from "@app/shared";

import { AuthResultViewSchema, LogoutResultViewSchema } from "@app/shared";

import {
  authControllerLogout,
  authControllerRefresh,
} from "@/shared/api/generated/endpoints/auth/auth";

export async function logout(): Promise<LogoutResultView> {
  const body = await authControllerLogout();
  return LogoutResultViewSchema.parse(body);
}

export async function refreshSession(): Promise<AuthResultView> {
  const body = await authControllerRefresh();
  return AuthResultViewSchema.parse(body);
}
