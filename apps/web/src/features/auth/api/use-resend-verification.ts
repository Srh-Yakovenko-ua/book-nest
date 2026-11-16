import type { ResendVerificationInput } from "@app/shared";

import { useMutation } from "@tanstack/react-query";
import { type z } from "zod";

import { authControllerResendVerification } from "@/shared/api/generated/endpoints/auth/auth";

import { ResendVerificationResultSchema } from "./schemas";

type ResendVerificationResult = z.infer<typeof ResendVerificationResultSchema>;

export function useResendVerification() {
  return useMutation({
    mutationFn: async (input: ResendVerificationInput): Promise<ResendVerificationResult> => {
      const body = await authControllerResendVerification(input);
      return ResendVerificationResultSchema.parse(body);
    },
  });
}
