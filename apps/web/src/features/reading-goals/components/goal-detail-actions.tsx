"use client";

import type { ReadingGoalDetail } from "@app/shared";

import { useTranslations } from "next-intl";
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
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";

import { useArchiveGoal } from "../api/use-archive-goal";
import { useDeleteGoal } from "../api/use-delete-goal";
import { GoalFormDialog } from "./goal-form-dialog";

type GoalDetailActionsProps = {
  goal: ReadingGoalDetail;
};

export function GoalDetailActions({ goal }: GoalDetailActionsProps) {
  const t = useTranslations("goals.detail");
  const tToast = useTranslations("goals.toast");
  const router = useRouter();

  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const editOpenerRef = useRef<HTMLButtonElement>(null);
  const archiveOpenerRef = useRef<HTMLButtonElement>(null);
  const deleteOpenerRef = useRef<HTMLButtonElement>(null);

  const archiveGoal = useArchiveGoal();
  const deleteGoal = useDeleteGoal();

  const isArchived = goal.status === "archived";

  function returnFocusAfterArchive(event: Event) {
    event.preventDefault();
    const opener = archiveGoal.isSuccess ? deleteOpenerRef : archiveOpenerRef;
    opener.current?.focus();
  }

  function returnFocusAfterDelete(event: Event) {
    event.preventDefault();
    deleteOpenerRef.current?.focus();
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
      { goalId: goal.id },
      {
        onError: () => toast.error(tToast("error")),
        onSuccess: () => {
          toast.success(tToast("deleted"));
          router.replace("/goals");
        },
      },
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {isArchived ? null : (
          <>
            <Button onClick={() => setEditOpen(true)} ref={editOpenerRef} variant="secondary">
              <UiIcon name="edit" size={16} />
              {t("edit")}
            </Button>
            <Button onClick={() => setArchiveOpen(true)} ref={archiveOpenerRef} variant="secondary">
              <UiIcon name="inbox" size={16} />
              {t("archive")}
            </Button>
          </>
        )}
        <Button
          className="sm:ml-auto"
          onClick={() => setDeleteOpen(true)}
          ref={deleteOpenerRef}
          variant="destructive"
        >
          <UiIcon name="trash" size={16} />
          {t("delete")}
        </Button>
      </div>

      {isArchived ? null : (
        <GoalFormDialog
          bookCount={goal.snapshotBookCount}
          listName={goal.list?.name ?? null}
          mode={{ goal, kind: "edit" }}
          onOpenChange={setEditOpen}
          open={editOpen}
          openerRef={editOpenerRef}
        />
      )}

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !archiveGoal.isPending) setArchiveOpen(false);
        }}
        open={archiveOpen}
      >
        <AlertDialogContent onCloseAutoFocus={returnFocusAfterArchive} size="sm">
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
        <AlertDialogContent onCloseAutoFocus={returnFocusAfterDelete} size="sm">
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
    </>
  );
}
