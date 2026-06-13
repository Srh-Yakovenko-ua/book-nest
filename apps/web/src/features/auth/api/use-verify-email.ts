import type { AuthResultView, VerifyEmailInput } from "@app/shared";

import { useMutation } from "@tanstack/react-query";

import { request } from "@/lib/http-client";

import { useAuthStore } from "../model/auth-store";
import { AuthResultSchema } from "./schemas";

export function useVerifyEmail() {
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: async (input: VerifyEmailInput): Promise<AuthResultView> => {
      const body = await request<unknown>("/api/auth/verify-email", {
        body: JSON.stringify(input),
        method: "POST",
      });
      return AuthResultSchema.parse(body);
    },
    onSuccess: (result) => {
      setSession(result.accessToken, result.user);
    },
  });
}
