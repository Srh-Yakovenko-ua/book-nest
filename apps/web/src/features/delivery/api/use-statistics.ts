import type { BookOrderStatisticsView } from "@app/shared";

import { BookOrderStatisticsViewSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { BookOrdersControllerStatisticsParams } from "@/shared/api/generated/model";

import { bookOrdersControllerStatistics } from "@/shared/api/generated/endpoints/book-orders/book-orders";

export function useStatistics(params: BookOrdersControllerStatisticsParams) {
  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<BookOrderStatisticsView> =>
      BookOrderStatisticsViewSchema.parse(await bookOrdersControllerStatistics(params)),
    queryKey: ["/api/delivery/orders/statistics", params],
  });
}
