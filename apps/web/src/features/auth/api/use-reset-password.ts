import type { ResetPasswordInput, ResetPasswordResultView } from "@app/shared";

import { useMutation } from "@tanstack/react-query";

import { request } from "@/lib/http-client";

import { ResetPasswordResultSchema } from "./schemas";

export function useResetPassword() {
  return useMutation({
    mutationFn: async (input: ResetPasswordInput): Promise<ResetPasswordResultView> => {
      const body = await request<unknown>("/api/auth/reset-password", {
        body: JSON.stringify(input),
        method: "POST",
      });
      return ResetPasswordResultSchema.parse(body);
    },
  });
}
