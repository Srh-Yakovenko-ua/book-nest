import type { HomeAttentionView } from "@app/shared";

import { HomeAttentionViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { homeControllerGetAttention } from "@/shared/api/generated/endpoints/home/home";

import { homeKeys } from "./home-keys";

export function useHomeAttention() {
  return useQuery({
    queryFn: async ({ signal }): Promise<HomeAttentionView> =>
      HomeAttentionViewSchema.parse(await homeControllerGetAttention({ signal })),
    queryKey: homeKeys.attention(),
  });
}
