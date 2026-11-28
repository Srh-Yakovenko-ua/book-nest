"use client";

import type { ReactNode, Ref } from "react";

import { useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { BOOK_CREATE_PATH, useLibraryPresence } from "@/features/books";
import { useLists } from "@/features/lists";
import { useRouter } from "@/i18n/navigation";
import { assertNever } from "@/lib/assert-never";
import { toCollectionPresence } from "@/lib/collection-presence";

import type { GoalsFirstStep } from "../model/goals-first-step";

import { goalListPickerParams } from "../model/goal-list-picker-content";
import { resolveGoalsFirstStep } from "../model/goals-first-step";

const GOALS_FIRST_STEP_HREF = {
  addFirstBook: BOOK_CREATE_PATH,
  openLists: "/lists",
} as const;

type GoalsFirstStepStateProps = {
  createButtonRef: Ref<HTMLButtonElement>;
  onCreate: () => void;
  pendingFallback: ReactNode;
  retryButtonRef: Ref<HTMLButtonElement>;
  withRetryFocus: (onRetry: () => void) => () => void;
};

export function GoalsFirstStepState({
  createButtonRef,
  onCreate,
  pendingFallback,
  retryButtonRef,
  withRetryFocus,
}: GoalsFirstStepStateProps) {
  const t = useTranslations("goals.catalog");
  const tBooks = useTranslations("books");
  const router = useRouter();
  const step = useGoalsFirstStep();

  switch (step.kind) {
    case "add-first-book": {
      const noBooksState: EmptyStateEntry = {
        desc: t("empty.noBooks.description"),
        illu: "reading-goals/goal-first-goal-empty-state",
        illuSize: "lg",
        primary: { icon: "plus", label: tBooks("firstBook.cta") },
        title: t("empty.noBooks.title"),
      };
      return (
        <EmptyState
          onPrimary={() => router.push(GOALS_FIRST_STEP_HREF.addFirstBook)}
          state={noBooksState}
        />
      );
    }
    case "create-goal": {
      const createGoalState: EmptyStateEntry = {
        desc: t("empty.description"),
        illu: "reading-goals/goal-first-goal-empty-state",
        illuSize: "lg",
        primary: { icon: "plus", label: t("empty.create") },
        title: t("empty.title"),
      };
      return (
        <EmptyState onPrimary={onCreate} primaryRef={createButtonRef} state={createGoalState} />
      );
    }
    case "error": {
      const errorState: EmptyStateEntry = {
        desc: t("error.description"),
        illu: "error-generic",
        primary: { icon: "refresh", label: t("error.retry") },
        title: t("error.title"),
      };
      return (
        <div aria-live="assertive" role="alert">
          <EmptyState
            onPrimary={withRetryFocus(step.retry)}
            primaryRef={retryButtonRef}
            state={errorState}
          />
        </div>
      );
    }
    case "fill-list": {
      const noListsState: EmptyStateEntry = {
        desc: t("empty.noLists.description"),
        illu: "reading-goals/goal-first-goal-empty-state",
        illuSize: "lg",
        primary: { icon: "list", label: t("empty.noLists.cta") },
        title: t("empty.noLists.title"),
      };
      return (
        <EmptyState
          onPrimary={() => router.push(GOALS_FIRST_STEP_HREF.openLists)}
          state={noListsState}
        />
      );
    }
    case "pending":
      return pendingFallback;
    default:
      return assertNever(step);
  }
}

export function ShowUntilFirstStepResolved({ children }: { children: ReactNode }) {
  const step = useGoalsFirstStep();
  return step.kind === "error" || step.kind === "pending" ? children : null;
}

function useGoalsFirstStep(): GoalsFirstStep {
  const library = useLibraryPresence();
  const lists = useLists(goalListPickerParams(""));
  return resolveGoalsFirstStep({
    eligibleLists: toCollectionPresence({
      query: lists,
      total: (data) => data.pages[0]?.totalCount ?? 0,
    }),
    library,
  });
}
