import type { AuthResultView, LoginInput } from "@app/shared";

import { useMutation } from "@tanstack/react-query";

import { request } from "@/lib/http-client";

import { useAuthStore } from "../model/auth-store";
import { AuthResultSchema } from "./schemas";

export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: async (input: LoginInput): Promise<AuthResultView> => {
      const body = await request<unknown>("/api/auth/login", {
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
