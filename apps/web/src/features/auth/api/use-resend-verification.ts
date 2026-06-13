import type { RegistrationResultView, ResendVerificationInput } from "@app/shared";

import { useMutation } from "@tanstack/react-query";

import { request } from "@/lib/http-client";

import { RegistrationResultSchema } from "./schemas";

export function useResendVerification() {
  return useMutation({
    mutationFn: async (input: ResendVerificationInput): Promise<RegistrationResultView> => {
      const body = await request<unknown>("/api/auth/resend-verification", {
        body: JSON.stringify(input),
        method: "POST",
      });
      return RegistrationResultSchema.parse(body);
    },
  });
}
