"use client";

import type { Nullable, TimelineEventView } from "@app/shared";

import { useTranslations } from "next-intl";
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

import { useDeleteTimelineEvent } from "../api/use-delete-timeline-event";

type DeleteEventDialogProps = {
  bookId: string;
  event: Nullable<TimelineEventView>;
  onOpenChange: (open: boolean) => void;
};

export function DeleteEventDialog({ bookId, event, onOpenChange }: DeleteEventDialogProps) {
  const t = useTranslations("timeline.deleteDialog");
  const tToast = useTranslations("timeline.toast");
  const deleteEvent = useDeleteTimelineEvent();

  function confirm() {
    if (event === null) return;
    deleteEvent.mutate(
      { bookId, eventId: event.id },
      {
        onError: () => toast.error(tToast("deleteError")),
        onSuccess: () => {
          toast.success(tToast("deleted"));
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <AlertDialog onOpenChange={onOpenChange} open={event !== null}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <UiIcon name="alert-triangle" size={24} />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteEvent.isPending}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleteEvent.isPending}
            onClick={(clickEvent) => {
              clickEvent.preventDefault();
              confirm();
            }}
            variant="destructive"
          >
            {deleteEvent.isPending ? t("deleting") : t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
