import type { LoanDirection } from "@app/shared";

import { toCollectionPresence } from "@/lib/collection-presence";

import type { LibraryPresence } from "./use-library-presence";

import { libraryListParams } from "../model/library-query";
import { LOAN_CANDIDATE_OWNERSHIP } from "../model/loan-candidate-books";
import { useLibraryBooks } from "./use-books";

const LOAN_CANDIDATES_PROBE = { pageSize: 1 } as const;

export function useLoanCandidatesPresence(direction: LoanDirection): LibraryPresence {
  const candidates = useLibraryBooks(
    libraryListParams({
      owner: [...LOAN_CANDIDATE_OWNERSHIP[direction]],
      pageSize: LOAN_CANDIDATES_PROBE.pageSize,
    }),
  );
  return toCollectionPresence({
    query: candidates,
    total: (data) => data.pages[0]?.totalCount ?? 0,
  });
}
