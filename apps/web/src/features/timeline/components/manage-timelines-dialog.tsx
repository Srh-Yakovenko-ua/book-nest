"use client";

import type { ReorderTimelinesInput, TimelineView } from "@app/shared";

import { TIMELINE_ERROR_CODES } from "@app/shared";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/http-client";

import { useBookTimelines } from "../api/use-book-timelines";
import { useReorderTimelines } from "../api/use-reorder-timelines";
import { useSetDefaultTimeline } from "../api/use-set-default-timeline";
import { ManageTimelineRow } from "./manage-timeline-row";

const MANAGE_SKELETON_ROWS = 3;

type ManageTimelinesDialogProps = {
  bookId: string;
  onClose: () => void;
  onCreate: () => void;
  onDelete: (timeline: TimelineView) => void;
  onEdit: (timeline: TimelineView) => void;
};

type MoveTimelineOptions = {
  direction: "down" | "up";
  index: number;
};

export function ManageTimelinesDialog({
  bookId,
  onClose,
  onCreate,
  onDelete,
  onEdit,
}: ManageTimelinesDialogProps) {
  const t = useTranslations("timeline.manage");
  const tRoot = useTranslations("timeline");
  const tToast = useTranslations("timeline.toast");

  const timelinesQuery = useBookTimelines(bookId);
  const reorderTimelines = useReorderTimelines();
  const setDefaultTimeline = useSetDefaultTimeline();
  const operationInFlightRef = useRef(false);
  const isBusy = reorderTimelines.isPending || setDefaultTimeline.isPending;

  const orderedTimelines = [...(timelinesQuery.data?.timelines ?? [])].sort(
    (first, second) => first.position - second.position,
  );

  function isBlocked() {
    return isBusy || operationInFlightRef.current;
  }

  function releaseOperation() {
    operationInFlightRef.current = false;
  }

  function handleMutationError(error: unknown) {
    if (
      error instanceof ApiError &&
      (error.status === 409 || error.code === TIMELINE_ERROR_CODES.reorderConflict)
    ) {
      toast.error(tToast("reorderConflict"));
      void timelinesQuery.refetch();
      return;
    }
    toast.error(tToast("lineError"));
  }

  function moveTimeline({ direction, index }: MoveTimelineOptions) {
    if (isBlocked()) return;

    const timeline = orderedTimelines[index];
    const neighbor = orderedTimelines[direction === "up" ? index - 1 : index + 1];
    if (timeline === undefined || neighbor === undefined) return;

    const input: ReorderTimelinesInput =
      direction === "up"
        ? {
            beforeTimelineId: neighbor.id,
            expectedUpdatedAt: timeline.updatedAt,
            timelineId: timeline.id,
          }
        : {
            afterTimelineId: neighbor.id,
            expectedUpdatedAt: timeline.updatedAt,
            timelineId: timeline.id,
          };

    operationInFlightRef.current = true;
    reorderTimelines.mutate(
      { bookId, input },
      {
        onError: handleMutationError,
        onSettled: releaseOperation,
        onSuccess: () => toast.success(tToast("reordered")),
      },
    );
  }

  function makeDefault(timeline: TimelineView) {
    if (isBlocked()) return;

    operationInFlightRef.current = true;
    setDefaultTimeline.mutate(
      { bookId, input: { expectedUpdatedAt: timeline.updatedAt }, timelineId: timeline.id },
      {
        onError: handleMutationError,
        onSettled: releaseOperation,
        onSuccess: () => toast.success(tToast("defaultChanged")),
      },
    );
  }

  function handleCreate() {
    if (isBlocked()) return;
    onCreate();
  }

  function handleEdit(timeline: TimelineView) {
    if (isBlocked()) return;
    onEdit(timeline);
  }

  function handleDelete(timeline: TimelineView) {
    if (isBlocked()) return;
    onDelete(timeline);
  }

  function renderBody() {
    if (timelinesQuery.data === undefined) {
      if (timelinesQuery.isError) {
        return <ManageTimelinesError onRetry={() => void timelinesQuery.refetch()} />;
      }
      return <ManageTimelinesLoading />;
    }

    if (orderedTimelines.length === 0) return <ManageTimelinesEmpty onCreate={handleCreate} />;

    return (
      <>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground tabular-nums">
            {t("lineCount", { count: orderedTimelines.length })}
          </span>
          <Button disabled={isBusy} onClick={handleCreate} size="sm" type="button">
            <UiIcon name="plus" size={16} />
            {tRoot("newLine")}
          </Button>
        </div>

        <div className="min-h-0 overflow-hidden rounded-lg border border-border">
          <ul className="flex max-h-[60vh] min-h-0 flex-col divide-y divide-border overflow-x-hidden overflow-y-auto">
            {orderedTimelines.map((timeline, index) => (
              <ManageTimelineRow
                canMoveDown={index < orderedTimelines.length - 1}
                canMoveUp={index > 0}
                isBusy={isBusy}
                key={timeline.id}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onMakeDefault={makeDefault}
                onMove={(direction) => moveTimeline({ direction, index })}
                timeline={timeline}
              />
            ))}
          </ul>
        </div>
      </>
    );
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
    >
      <DialogContent className="flex max-h-[92vh] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
          <p className="text-xs text-muted-foreground">{t("autoSaveHint")}</p>
        </DialogHeader>

        {renderBody()}
      </DialogContent>
    </Dialog>
  );
}

function ManageTimelinesEmpty({ onCreate }: { onCreate: () => void }) {
  const t = useTranslations("timeline.manage");
  const tRoot = useTranslations("timeline");

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-8 text-center">
      <p className="text-sm text-muted-foreground">{t("emptyTitle")}</p>
      <Button onClick={onCreate} size="sm" type="button">
        <UiIcon name="plus" size={16} />
        {tRoot("newLine")}
      </Button>
    </div>
  );
}

function ManageTimelinesError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("timeline.states");

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border p-3">
      <p className="text-sm text-muted-foreground">{t("errorText")}</p>
      <Button onClick={onRetry} size="sm" type="button" variant="secondary">
        <UiIcon name="refresh" size={14} />
        {t("retry")}
      </Button>
    </div>
  );
}

function ManageTimelinesLoading() {
  const t = useTranslations("timeline.manage");

  return (
    <div aria-busy aria-label={t("loading")} className="flex flex-col gap-2" role="status">
      {Array.from({ length: MANAGE_SKELETON_ROWS }, (_, index) => (
        <Skeleton className="h-16 w-full rounded-lg" key={index} />
      ))}
    </div>
  );
}
