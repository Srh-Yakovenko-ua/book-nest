"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { GoalFormDialog, type GoalListChoice, GoalListPicker } from "@/features/reading-goals";
import { useRouter } from "@/i18n/navigation";

import { homeGoalHref } from "../model/home-context-links";

type GoalCreationFlow =
  Extract<GoalListChoice, { kind: "create" }> | { kind: "closed" } | { kind: "picking" };

export function HomeGoalCreateFlow() {
  const t = useTranslations("home.goal");
  const tToast = useTranslations("goals.toast");
  const router = useRouter();
  const [flow, setFlow] = useState<GoalCreationFlow>({ kind: "closed" });
  const createButtonRef = useRef<HTMLButtonElement>(null);

  function closeFlowWhenDismissed(open: boolean) {
    if (open) return;
    setFlow({ kind: "closed" });
  }

  function continueWith(choice: GoalListChoice) {
    if (choice.kind === "active") {
      setFlow({ kind: "closed" });
      toast.info(tToast("activeExists"));
      router.push(homeGoalHref(choice.goalId));
      return;
    }
    setFlow(choice);
  }

  return (
    <>
      <Button
        onClick={() => setFlow({ kind: "picking" })}
        ref={createButtonRef}
        size="sm"
        variant="secondary"
      >
        <UiIcon aria-hidden name="plus" size={14} />
        {t("create")}
      </Button>

      <GoalListPicker
        onChoose={continueWith}
        onOpenChange={closeFlowWhenDismissed}
        open={flow.kind === "picking"}
        openerRef={createButtonRef}
      />

      {flow.kind === "create" ? (
        <GoalFormDialog
          bookCount={flow.list.bookCount}
          listName={flow.list.name}
          mode={{ kind: "create", listId: flow.list.id, previousOutcome: flow.previousOutcome }}
          onCreated={(goal) => router.push(homeGoalHref(goal.id))}
          onOpenChange={closeFlowWhenDismissed}
          open
          openerRef={createButtonRef}
        />
      ) : null}
    </>
  );
}
