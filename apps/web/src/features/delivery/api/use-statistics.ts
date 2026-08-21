import type { BookOrderStatisticsView } from "@app/shared";

import { BookOrderStatisticsViewSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { BookOrdersControllerStatisticsParams } from "@/shared/api/generated/model";

import { bookOrdersControllerStatistics } from "@/shared/api/generated/endpoints/book-orders/book-orders";

export const STATISTICS_QUERY_KEY = "/api/delivery/orders/statistics";

export function useStatistics(
  params: BookOrdersControllerStatisticsParams,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<BookOrderStatisticsView> =>
      BookOrderStatisticsViewSchema.parse(await bookOrdersControllerStatistics(params)),
    queryKey: [STATISTICS_QUERY_KEY, params],
  });
}
