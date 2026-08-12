"use client";

import type { Nullable, ReadingGoalView } from "@app/shared";
import type { RefObject } from "react";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useListGoal } from "../api/use-list-goal";
import { GoalFormDialog } from "./goal-form-dialog";

const NO_BOOKS_HINT_ID = "list-goal-no-books-hint";

type ClosedOutcome = "completed" | "expired";

type GoalCardState =
  | { goal: ReadingGoalView; kind: "active" }
  | { goal: ReadingGoalView; kind: "closed"; outcome: ClosedOutcome }
  | { kind: "empty" }
  | { kind: "loading" };

type ListGoalCardProps = {
  bookCount: number;
  listId: string;
  listName: string;
};

export function ListGoalCard({ bookCount, listId, listName }: ListGoalCardProps) {
  const t = useTranslations("goals.sidebar");
  const [formOpen, setFormOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  const { data, isPending } = useListGoal(listId);
  const state = resolveState({ goal: data ?? null, isPending });

  return (
    <section className="sidebar-card-leaf flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-5 shadow-soft">
      <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-ink">
        <UiIcon aria-hidden className="shrink-0 text-primary/70" name="target" size={20} />
        {t("title")}
      </h2>

      <CardBody
        bookCount={bookCount}
        onCreate={() => setFormOpen(true)}
        openerRef={openerRef}
        state={state}
      />

      <GoalFormDialog
        bookCount={bookCount}
        listName={listName}
        mode={{ kind: "create", listId }}
        onOpenChange={setFormOpen}
        open={formOpen}
        openerRef={openerRef}
      />
    </section>
  );
}

function ActiveGoalBody({ goal }: { goal: ReadingGoalView }) {
  const t = useTranslations("goals.sidebar");
  const tGoals = useTranslations("goals");
  const locale = useLocale();
  const percent = progressPercent(goal);

  return (
    <>
      <p className="font-heading text-sm leading-snug font-medium text-ink">
        {goal.name ??
          tGoals("fallbackName", {
            count: goal.targetCount,
            date: formatDateShort(goal.deadline, locale),
          })}
      </p>
      <p className="text-xs text-muted-foreground tabular-nums">
        {t("progress", { completed: goal.completedCount, target: goal.targetCount })}
      </p>
      <div className="flex items-center gap-2">
        <Progress
          aria-label={t("progressLabel", { percent })}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={percent}
          className="h-2 flex-1"
          value={percent}
        />
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{percent}%</span>
      </div>
      {goal.remainingCount === 0 ? null : (
        <p className="text-xs text-muted-foreground">
          {t("remaining", { count: goal.remainingCount })}
        </p>
      )}
      <ViewGoalButton goalId={goal.id} />
    </>
  );
}

function CardBody({
  bookCount,
  onCreate,
  openerRef,
  state,
}: {
  bookCount: number;
  onCreate: () => void;
  openerRef: RefObject<HTMLButtonElement | null>;
  state: GoalCardState;
}) {
  const t = useTranslations("goals.sidebar");

  switch (state.kind) {
    case "active":
      return <ActiveGoalBody goal={state.goal} />;
    case "closed":
      return (
        <ClosedGoalBody
          goal={state.goal}
          onCreateNew={onCreate}
          openerRef={openerRef}
          outcome={state.outcome}
        />
      );
    case "empty":
      return (
        <>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("emptyDescription")}</p>
          <Button
            aria-describedby={bookCount === 0 ? NO_BOOKS_HINT_ID : undefined}
            className="w-full"
            disabled={bookCount === 0}
            onClick={onCreate}
            ref={openerRef}
            variant="secondary"
          >
            <UiIcon name="plus" size={16} />
            {t("create")}
          </Button>
          {bookCount === 0 ? (
            <p className="text-xs text-muted-foreground" id={NO_BOOKS_HINT_ID}>
              {t("noBooksHint")}
            </p>
          ) : null}
        </>
      );
    case "loading":
      return (
        <output aria-busy="true" aria-label={t("loading")} className="flex flex-col gap-3">
          <Skeleton className="h-4 w-40 rounded-md" />
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-8 w-full rounded-lg" />
        </output>
      );
  }
}

function ClosedGoalBody({
  goal,
  onCreateNew,
  openerRef,
  outcome,
}: {
  goal: ReadingGoalView;
  onCreateNew: () => void;
  openerRef: RefObject<HTMLButtonElement | null>;
  outcome: ClosedOutcome;
}) {
  const t = useTranslations("goals.sidebar");
  const locale = useLocale();
  const isCompleted = outcome === "completed";
  const counts = { completed: goal.completedCount, target: goal.targetCount };

  function detail(): string {
    if (isCompleted) {
      if (goal.completedAt === null) return t("completed.detailPlain", counts);
      return t("completed.detail", { ...counts, date: formatDateShort(goal.completedAt, locale) });
    }
    if (goal.daysLeft === null) return t("expired.detailPlain", counts);
    return t("expired.detail", { ...counts, count: Math.abs(goal.daysLeft) });
  }

  return (
    <>
      <p
        className={cn(
          "flex items-center gap-1.5 font-heading text-sm font-medium",
          isCompleted ? "text-success" : "text-warning",
        )}
      >
        <UiIcon aria-hidden name={isCompleted ? "trophy" : "clock"} size={16} />
        {isCompleted ? t("completed.title") : t("expired.title")}
      </p>
      <p className="text-xs text-muted-foreground tabular-nums">{detail()}</p>
      <div className="flex flex-col gap-2">
        <ViewGoalButton goalId={goal.id} />
        <Button className="w-full" onClick={onCreateNew} ref={openerRef} variant="secondary">
          <UiIcon name="plus" size={16} />
          {t("createNew")}
        </Button>
      </div>
    </>
  );
}

function progressPercent(goal: ReadingGoalView): number {
  return Math.min(100, Math.round((goal.completedCount / goal.targetCount) * 100));
}

function resolveState({
  goal,
  isPending,
}: {
  goal: Nullable<ReadingGoalView>;
  isPending: boolean;
}): GoalCardState {
  if (isPending) return { kind: "loading" };
  if (goal === null) return { kind: "empty" };

  switch (goal.status) {
    case "active":
      return { goal, kind: "active" };
    case "archived":
      return { kind: "empty" };
    case "completed":
    case "expired":
      return { goal, kind: "closed", outcome: goal.status };
  }
}

function ViewGoalButton({ goalId }: { goalId: string }) {
  const t = useTranslations("goals.sidebar");

  return (
    <Button asChild className="w-full" variant="secondary">
      <Link href={`/goals/${goalId}`}>
        <UiIcon name="arrow-right" size={16} />
        {t("view")}
      </Link>
    </Button>
  );
}
