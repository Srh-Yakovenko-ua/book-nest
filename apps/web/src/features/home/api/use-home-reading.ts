import { HomeReadingViewSchema } from "@app/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { homeControllerGetReading } from "@/shared/api/generated/endpoints/home/home";

import { type HomeReadingState, mergeHomeReading } from "../model/home-reading";
import { homeKeys } from "./home-keys";

export function useHomeReading() {
  const queryClient = useQueryClient();

  return useQuery({
    queryFn: async ({ signal }): Promise<HomeReadingState> => {
      const view = HomeReadingViewSchema.parse(await homeControllerGetReading({ signal }));
      return mergeHomeReading({
        next: view,
        previous: queryClient.getQueryData<HomeReadingState>(homeKeys.reading()),
      });
    },
    queryKey: homeKeys.reading(),
  });
}
