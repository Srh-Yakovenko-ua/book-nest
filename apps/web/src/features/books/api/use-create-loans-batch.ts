import type { CreateLoansBatchInput, CreateLoansBatchResult } from "@app/shared";

import { CreateLoansBatchResultSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { bookLoanBatchControllerCreateLoans } from "@/shared/api/generated/endpoints/books/books";

import { bookChangeEffects } from "./book-change-effects";

export function useCreateLoansBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateLoansBatchInput): Promise<CreateLoansBatchResult> =>
      CreateLoansBatchResultSchema.parse(await bookLoanBatchControllerCreateLoans(input)),
    onSuccess: () => {
      void bookChangeEffects.booksChanged(queryClient, { changes: ["loanChanged"] });
    },
  });
}
