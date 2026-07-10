import { PaginatedLoansSchema } from "@app/shared";
import { keepPreviousData } from "@tanstack/react-query";

import type { LoansControllerListParams } from "@/shared/api/generated/model";

import { useLoansControllerList } from "@/shared/api/generated/endpoints/loans/loans";

export function useLoansList(params: LoansControllerListParams) {
  return useLoansControllerList(params, {
    query: {
      placeholderData: keepPreviousData,
      select: (data) => PaginatedLoansSchema.parse(data),
    },
  });
}
