import type { NicknameAvailabilityView } from "@app/shared";

import { NicknameSchema } from "@app/shared";
import { keepPreviousData, skipToken, useQuery } from "@tanstack/react-query";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { authControllerCheckNicknameAvailability } from "@/shared/api/generated/endpoints/auth/auth";

import { authKeys } from "./auth-keys";
import { NicknameAvailabilitySchema } from "./schemas";

const DEBOUNCE_MS = 400;

export function useNicknameAvailability(nickname: string) {
  const debounced = useDebouncedValue(nickname.trim(), DEBOUNCE_MS);
  const parsed = NicknameSchema.safeParse(debounced);
  const validNickname = parsed.success ? parsed.data : null;

  const query = useQuery({
    placeholderData: keepPreviousData,
    queryFn:
      validNickname === null
        ? skipToken
        : async ({ signal }): Promise<NicknameAvailabilityView> =>
            NicknameAvailabilitySchema.parse(
              await authControllerCheckNicknameAvailability(
                { nickname: validNickname },
                { signal },
              ),
            ),
    queryKey: authKeys.nicknameAvailability(validNickname),
  });

  return {
    data: validNickname === null ? undefined : query.data,
    isLoading: validNickname !== null && query.isFetching,
  };
}
