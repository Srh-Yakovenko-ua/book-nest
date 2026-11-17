import type { AuthResultView, VerifyEmailInput } from "@app/shared";

import { AuthResultViewSchema } from "@app/shared";
import { useMutation } from "@tanstack/react-query";

import { authControllerVerifyEmail } from "@/shared/api/generated/endpoints/auth/auth";

import { useAuthStore } from "../model/auth-store";

export function useVerifyEmail() {
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: async (input: VerifyEmailInput): Promise<AuthResultView> => {
      const body = await authControllerVerifyEmail(input);
      return AuthResultViewSchema.parse(body);
    },
    onSuccess: (result) => {
      setSession(result.accessToken, result.user);
    },
  });
}
