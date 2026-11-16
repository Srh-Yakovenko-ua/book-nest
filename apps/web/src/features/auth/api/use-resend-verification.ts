import type { ResendVerificationInput, ResendVerificationResultView } from "@app/shared";

import { ResendVerificationResultViewSchema } from "@app/shared";
import { useMutation } from "@tanstack/react-query";

import { authControllerResendVerification } from "@/shared/api/generated/endpoints/auth/auth";

export function useResendVerification() {
  return useMutation({
    mutationFn: async (input: ResendVerificationInput): Promise<ResendVerificationResultView> => {
      const body = await authControllerResendVerification(input);
      return ResendVerificationResultViewSchema.parse(body);
    },
  });
}
