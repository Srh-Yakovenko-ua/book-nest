import type { RegistrationInput, RegistrationResultView } from "@app/shared";

import { useMutation } from "@tanstack/react-query";

import { request } from "@/lib/http-client";

import { RegistrationResultSchema } from "./schemas";

export function useRegister() {
  return useMutation({
    mutationFn: async (input: RegistrationInput): Promise<RegistrationResultView> => {
      const body = await request<unknown>("/api/auth/registration", {
        body: JSON.stringify(input),
        method: "POST",
      });
      return RegistrationResultSchema.parse(body);
    },
  });
}
