"use client";

import type { Nullable, ReadingGoalDetail } from "@app/shared";
import type { RefObject } from "react";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "@/i18n/navigation";

import { useArchiveGoal } from "../api/use-archive-goal";
import { useDeleteGoal } from "../api/use-delete-goal";
import { GoalFormDialog } from "./goal-form-dialog";

type GoalActionOpener = "inline" | "menu";

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
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const dialogOpenerRef = useRef<GoalActionOpener>("inline");

  const archiveGoal = useArchiveGoal();
  const deleteGoal = useDeleteGoal();

  const isArchived = goal.status === "archived";

  function openArchive(opener: GoalActionOpener) {
    dialogOpenerRef.current = opener;
    setArchiveOpen(true);
  }

  function openDelete(opener: GoalActionOpener) {
    dialogOpenerRef.current = opener;
    setDeleteOpen(true);
  }

  function returnFocusTo(inlineOpener: RefObject<Nullable<HTMLButtonElement>>) {
    const opener = dialogOpenerRef.current === "menu" ? menuTriggerRef : inlineOpener;
    dialogOpenerRef.current = "inline";
    opener.current?.focus();
  }

  function returnFocusAfterArchive(event: Event) {
    event.preventDefault();
    returnFocusTo(archiveGoal.isSuccess ? deleteOpenerRef : archiveOpenerRef);
  }

  function returnFocusAfterDelete(event: Event) {
    event.preventDefault();
    returnFocusTo(deleteOpenerRef);
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
      <div className="flex shrink-0 items-center gap-2">
        {isArchived ? null : (
          <>
            <Button onClick={() => setEditOpen(true)} ref={editOpenerRef} variant="secondary">
              <UiIcon name="edit" size={16} />
              {t("edit")}
            </Button>
            <Button
              className="max-sm:hidden"
              onClick={() => openArchive("inline")}
              ref={archiveOpenerRef}
              variant="secondary"
            >
              <UiIcon name="inbox" size={16} />
              {t("archive")}
            </Button>
          </>
        )}
        <Button
          className="max-sm:hidden"
          onClick={() => openDelete("inline")}
          ref={deleteOpenerRef}
          variant="destructive"
        >
          <UiIcon name="trash" size={16} />
          {t("delete")}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={t("moreActions")}
              className="size-11 sm:hidden"
              ref={menuTriggerRef}
              size="icon"
              variant="secondary"
            >
              <UiIcon name="more" size={18} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48"
            onCloseAutoFocus={(event) => {
              if (dialogOpenerRef.current === "menu") event.preventDefault();
            }}
          >
            {isArchived ? null : (
              <DropdownMenuItem onSelect={() => openArchive("menu")}>
                <UiIcon name="inbox" size={16} />
                {t("archive")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => openDelete("menu")} variant="destructive">
              <UiIcon name="trash" size={16} />
              {t("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
