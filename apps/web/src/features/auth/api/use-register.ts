import type { RegistrationInput, RegistrationResultView } from "@app/shared";

import { RegistrationResultViewSchema } from "@app/shared";
import { useMutation } from "@tanstack/react-query";

import { authControllerRegister } from "@/shared/api/generated/endpoints/auth/auth";

export function useRegister() {
  return useMutation({
    mutationFn: async (input: RegistrationInput): Promise<RegistrationResultView> => {
      const body = await authControllerRegister(input);
      return RegistrationResultViewSchema.parse(body);
    },
  });
}
