"use client";

import type { ReadingGoalDetail } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link, useRouter } from "@/i18n/navigation";
import { formatDateLong } from "@/lib/format";

import { useArchiveGoal } from "../api/use-archive-goal";
import { useDeleteGoal } from "../api/use-delete-goal";
import { GOAL_STATUS_BADGE } from "../model/goal-status";
import { GoalCountedBooks } from "./goal-counted-books";
import { GoalFormDialog } from "./goal-form-dialog";

type GoalDetailsViewProps = {
  goal: ReadingGoalDetail;
};

export function GoalDetailsView({ goal }: GoalDetailsViewProps) {
  const t = useTranslations("goals.detail");
  const tGoals = useTranslations("goals");
  const tStatus = useTranslations("goals.status");
  const tToast = useTranslations("goals.toast");
  const locale = useLocale();
  const router = useRouter();

  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const editOpenerRef = useRef<HTMLButtonElement>(null);

  const archiveGoal = useArchiveGoal();
  const deleteGoal = useDeleteGoal();

  const listHref = goal.list === null ? "/lists" : `/lists/${goal.list.id}`;
  const badge = GOAL_STATUS_BADGE[goal.status];
  const percent = Math.min(100, Math.round((goal.completedCount / goal.targetCount) * 100));
  const isArchived = goal.status === "archived";

  function metaLine(): string {
    const parts = [t("deadline", { date: formatDateLong(goal.deadline, locale) })];
    if (goal.completedAt !== null) {
      parts.push(t("completedOn", { date: formatDateLong(goal.completedAt, locale) }));
    } else if (goal.daysLeft !== null && goal.daysLeft >= 0) {
      parts.push(t("daysLeft", { count: goal.daysLeft }));
    } else if (goal.daysLeft !== null) {
      parts.push(t("daysOverdue", { count: Math.abs(goal.daysLeft) }));
    }
    return parts.join(" · ");
  }

  function handleArchive() {
    archiveGoal.mutate(
      { goalId: goal.id },
      {
        onError: () => toast.error(tToast("error")),
        onSuccess: () => {
          toast.success(tToast("archived"));
          setArchiveOpen(false);
        },
      },
    );
  }

  function handleDelete() {
    deleteGoal.mutate(
      { goalId: goal.id, listId: goal.list?.id ?? null },
      {
        onError: () => toast.error(tToast("error")),
        onSuccess: () => {
          toast.success(tToast("deleted"));
          router.push(listHref);
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-2 lg:gap-8">
      <Link
        className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground no-underline transition-colors outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        href={listHref}
      >
        <UiIcon name="arrow-left" size={16} />
        {goal.list === null ? t("backToLists") : t("back", { name: goal.list.name })}
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="min-w-0 font-heading text-2xl font-semibold text-ink">
            {goal.name ??
              tGoals("fallbackName", {
                count: goal.targetCount,
                date: formatDateLong(goal.deadline, locale),
              })}
          </h1>
          <Badge className="h-6 gap-1.5 px-2.5" variant={badge.tone}>
            <UiIcon aria-hidden name={badge.icon} size={12} />
            {tStatus(goal.status)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{metaLine()}</p>
      </header>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <Progress
            aria-label={t("progressLabel", { percent })}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={percent}
            className="h-2.5 flex-1"
            value={percent}
          />
          <span className="shrink-0 text-sm font-semibold text-primary tabular-nums">
            {percent}%
          </span>
        </div>
        <p className="text-sm text-foreground tabular-nums">
          {t("progress", {
            completed: goal.completedCount,
            percent,
            target: goal.targetCount,
          })}
        </p>
        {goal.remainingCount === 0 ? null : (
          <p className="text-sm text-muted-foreground">
            {t("remaining", { count: goal.remainingCount })}
          </p>
        )}
      </section>

      <GoalCountedBooks books={goal.countedBooks} />

      <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center gap-2 border-t border-border bg-background/95 px-5 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
        {isArchived ? null : (
          <>
            <Button onClick={() => setEditOpen(true)} ref={editOpenerRef} variant="secondary">
              <UiIcon name="edit" size={16} />
              {t("edit")}
            </Button>
            <Button onClick={() => setArchiveOpen(true)} variant="secondary">
              <UiIcon name="inbox" size={16} />
              {t("archive")}
            </Button>
          </>
        )}
        <Button className="md:ml-auto" onClick={() => setDeleteOpen(true)} variant="destructive">
          <UiIcon name="trash" size={16} />
          {t("delete")}
        </Button>
      </div>

      <GoalFormDialog
        bookCount={goal.listBookCount}
        listName={goal.list?.name ?? null}
        mode={{ goal, kind: "edit" }}
        onOpenChange={setEditOpen}
        open={editOpen}
        openerRef={editOpenerRef}
      />

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !archiveGoal.isPending) setArchiveOpen(false);
        }}
        open={archiveOpen}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia>
              <UiIcon name="inbox" size={24} />
            </AlertDialogMedia>
            <AlertDialogTitle>{t("archiveDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("archiveDialog.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveGoal.isPending}>
              {t("archiveDialog.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={archiveGoal.isPending}
              onClick={(event) => {
                event.preventDefault();
                handleArchive();
              }}
            >
              {t("archiveDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !deleteGoal.isPending) setDeleteOpen(false);
        }}
        open={deleteOpen}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia>
              <UiIcon name="alert-triangle" size={24} />
            </AlertDialogMedia>
            <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteDialog.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteGoal.isPending}>
              {t("deleteDialog.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteGoal.isPending}
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
              variant="destructive"
            >
              {t("deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
