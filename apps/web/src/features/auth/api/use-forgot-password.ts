import type { ForgotPasswordInput, ForgotPasswordResultView } from "@app/shared";

import { ForgotPasswordResultViewSchema } from "@app/shared";
import { useMutation } from "@tanstack/react-query";

import { authControllerForgotPassword } from "@/shared/api/generated/endpoints/auth/auth";

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (input: ForgotPasswordInput): Promise<ForgotPasswordResultView> => {
      const body = await authControllerForgotPassword(input);
      return ForgotPasswordResultViewSchema.parse(body);
    },
  });
}
