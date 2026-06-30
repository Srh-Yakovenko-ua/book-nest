import type { ResendVerificationInput } from "@app/shared";

import { useMutation } from "@tanstack/react-query";
import { type z } from "zod";

import { request } from "@/lib/http-client";

import { ResendVerificationResultSchema } from "./schemas";

type ResendVerificationResult = z.infer<typeof ResendVerificationResultSchema>;

export function useResendVerification() {
  return useMutation({
    mutationFn: async (input: ResendVerificationInput): Promise<ResendVerificationResult> => {
      const body = await request<unknown>("/api/auth/resend-verification", {
        body: JSON.stringify(input),
        method: "POST",
      });
      return ResendVerificationResultSchema.parse(body);
    },
  });
}
