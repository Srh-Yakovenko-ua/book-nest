"use client";

import type { Nullable, ReadingGoalResult } from "@app/shared";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { useRouter } from "@/i18n/navigation";

import type { GoalListChoice, GoalListTarget } from "../model/goal-list-choice";

import { useGoalsCatalog } from "../api/use-goals-catalog";
import { toGoalDetailHref } from "../model/goal-catalog-href";
import { resolveGoalsCatalogContent } from "../model/goals-catalog-content";
import { useGoalsQuery } from "../model/use-goals-query";
import { GoalFormDialog } from "./goal-form-dialog";
import { GoalListPicker } from "./goal-list-picker";
import { GoalsCatalogView } from "./goals-catalog-view";
import { GoalsOverview } from "./goals-overview";
import { GoalsToolbar } from "./goals-toolbar";

type GoalCreationFlow =
  | { kind: "closed" }
  | { kind: "creating"; list: GoalListTarget; previousOutcome: Nullable<ReadingGoalResult> }
  | { kind: "picking"; returnListId: Nullable<string> };

export function GoalsCatalog() {
  const tToast = useTranslations("goals.toast");
  const router = useRouter();
  const goalsQuery = useGoalsQuery();
  const catalog = useGoalsCatalog(goalsQuery.listParams);
  const [flow, setFlow] = useState<GoalCreationFlow>({ kind: "closed" });
  const [pickerSearch, setPickerSearch] = useState("");
  const createButtonRef = useRef<HTMLButtonElement>(null);

  const content = resolveGoalsCatalogContent({
    goals: catalog.data?.pages.flatMap((page) => page.items) ?? [],
    hasNextPage: catalog.hasNextPage,
    isError: catalog.isError,
    isFetchingNextPage: catalog.isFetchingNextPage,
    isFetchNextPageError: catalog.isFetchNextPageError,
    isPending: catalog.isPending,
    status: goalsQuery.state.status,
  });

  function loadNextPage() {
    if (!catalog.hasNextPage || catalog.isFetchingNextPage) return;
    void catalog.fetchNextPage();
  }

  function closeFlowWhenDismissed(open: boolean) {
    if (open) return;
    setFlow({ kind: "closed" });
  }

  function startPicking() {
    setPickerSearch("");
    setFlow({ kind: "picking", returnListId: null });
  }

  function continueWith(choice: GoalListChoice) {
    if (choice.kind === "active") {
      setFlow({ kind: "closed" });
      toast.info(tToast("activeExists"));
      router.push(toGoalDetailHref({ catalog: goalsQuery.state, goalId: choice.goalId }));
      return;
    }
    setFlow({ kind: "creating", list: choice.list, previousOutcome: choice.previousOutcome });
  }

  return (
    <>
      <GoalsCatalogView
        content={content}
        createButtonRef={createButtonRef}
        onClearStatus={() => goalsQuery.setStatus(null)}
        onCreate={startPicking}
        onLoadMore={loadNextPage}
        onRetry={() => void catalog.refetch()}
        overview={<GoalsOverview />}
        toolbar={
          <GoalsToolbar
            onSortChange={goalsQuery.setSort}
            onStatusChange={goalsQuery.setStatus}
            onViewChange={goalsQuery.setView}
            state={goalsQuery.state}
          />
        }
        view={goalsQuery.state.view}
      />

      <GoalListPicker
        onChoose={continueWith}
        onOpenChange={closeFlowWhenDismissed}
        onSearchChange={setPickerSearch}
        open={flow.kind === "picking"}
        openerRef={createButtonRef}
        returnListId={flow.kind === "picking" ? flow.returnListId : null}
        search={pickerSearch}
      />

      {flow.kind === "creating" ? (
        <GoalFormDialog
          bookCount={flow.list.bookCount}
          listName={flow.list.name}
          mode={{ kind: "create", listId: flow.list.id, previousOutcome: flow.previousOutcome }}
          onChangeList={() => setFlow({ kind: "picking", returnListId: flow.list.id })}
          onCreated={(goal) =>
            router.push(toGoalDetailHref({ catalog: goalsQuery.state, goalId: goal.id }))
          }
          onOpenChange={closeFlowWhenDismissed}
          open
          openerRef={createButtonRef}
        />
      ) : null}
    </>
  );
}
