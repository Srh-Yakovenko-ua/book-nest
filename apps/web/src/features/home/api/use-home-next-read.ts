import type { HomeNextReadView } from "@app/shared";

import { HomeNextReadViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { homeControllerGetNextRead } from "@/shared/api/generated/endpoints/home/home";

import { homeKeys } from "./home-keys";

export function useHomeNextRead() {
  return useQuery({
    queryFn: async ({ signal }): Promise<HomeNextReadView> =>
      HomeNextReadViewSchema.parse(await homeControllerGetNextRead({ signal })),
    queryKey: homeKeys.nextRead(),
  });
}
