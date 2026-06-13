import type { NicknameAvailabilityView } from "@app/shared";

import { NicknameSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { request } from "@/lib/http-client";

import { NicknameAvailabilitySchema } from "./schemas";

const DEBOUNCE_MS = 400;

export function useNicknameAvailability(nickname: string) {
  const debounced = useDebouncedValue(nickname.trim(), DEBOUNCE_MS);
  const parsed = NicknameSchema.safeParse(debounced);
  const validNickname = parsed.success ? parsed.data : null;

  const query = useQuery({
    enabled: validNickname !== null,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<NicknameAvailabilityView> => {
      const search = new URLSearchParams({ nickname: validNickname ?? "" });
      const body = await request<unknown>(`/api/auth/nickname-available?${search.toString()}`, {
        method: "GET",
        signal,
      });
      return NicknameAvailabilitySchema.parse(body);
    },
    queryKey: ["auth", "nickname-available", validNickname],
  });

  return {
    data: validNickname === null ? undefined : query.data,
    isLoading: validNickname !== null && query.isFetching,
  };
}
