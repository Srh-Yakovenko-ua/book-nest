import type { ForgotPasswordInput, ForgotPasswordResultView } from "@app/shared";

import { useMutation } from "@tanstack/react-query";

import { authControllerForgotPassword } from "@/shared/api/generated/endpoints/auth/auth";

import { ForgotPasswordResultSchema } from "./schemas";

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (input: ForgotPasswordInput): Promise<ForgotPasswordResultView> => {
      const body = await authControllerForgotPassword(input);
      return ForgotPasswordResultSchema.parse(body);
    },
  });
}
