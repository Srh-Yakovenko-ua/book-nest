import type { ForgotPasswordInput, ForgotPasswordResultView } from "@app/shared";

import { useMutation } from "@tanstack/react-query";

import { request } from "@/lib/http-client";

import { ForgotPasswordResultSchema } from "./schemas";

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (input: ForgotPasswordInput): Promise<ForgotPasswordResultView> => {
      const body = await request<unknown>("/api/auth/forgot-password", {
        body: JSON.stringify(input),
        method: "POST",
      });
      return ForgotPasswordResultSchema.parse(body);
    },
  });
}
