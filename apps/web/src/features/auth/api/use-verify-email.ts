import type { AuthResultView, VerifyEmailInput } from "@app/shared";

import { useMutation } from "@tanstack/react-query";

import { authControllerVerifyEmail } from "@/shared/api/generated/endpoints/auth/auth";

import { useAuthStore } from "../model/auth-store";
import { AuthResultSchema } from "./schemas";

export function useVerifyEmail() {
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: async (input: VerifyEmailInput): Promise<AuthResultView> => {
      const body = await authControllerVerifyEmail(input);
      return AuthResultSchema.parse(body);
    },
    onSuccess: (result) => {
      setSession(result.accessToken, result.user);
    },
  });
}
