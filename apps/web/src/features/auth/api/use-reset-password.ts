import type { ResetPasswordInput, ResetPasswordResultView } from "@app/shared";

import { ResetPasswordResultViewSchema } from "@app/shared";
import { useMutation } from "@tanstack/react-query";

import { authControllerResetPassword } from "@/shared/api/generated/endpoints/auth/auth";

export function useResetPassword() {
  return useMutation({
    mutationFn: async (input: ResetPasswordInput): Promise<ResetPasswordResultView> => {
      const body = await authControllerResetPassword(input);
      return ResetPasswordResultViewSchema.parse(body);
    },
  });
}
