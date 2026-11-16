import type { AuthResultView, LoginInput } from "@app/shared";

import { useMutation } from "@tanstack/react-query";

import { authControllerLogin } from "@/shared/api/generated/endpoints/auth/auth";

import { useAuthStore } from "../model/auth-store";
import { AuthResultSchema } from "./schemas";

export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: async (input: LoginInput): Promise<AuthResultView> => {
      const body = await authControllerLogin(input);
      return AuthResultSchema.parse(body);
    },
    onSuccess: (result) => {
      setSession(result.accessToken, result.user);
    },
  });
}
