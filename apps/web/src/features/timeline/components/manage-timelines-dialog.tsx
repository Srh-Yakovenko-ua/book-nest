"use client";

import type { ReorderTimelinesInput, TimelineView } from "@app/shared";

import { TIMELINE_ERROR_CODES } from "@app/shared";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/http-client";

import { useBookTimelines } from "../api/use-book-timelines";
import { useReorderTimelines } from "../api/use-reorder-timelines";
import { useSetDefaultTimeline } from "../api/use-set-default-timeline";
import { markerStyle } from "../model/color-key";

const MANAGE_SKELETON_ROWS = 3;

type ManageTimelinesDialogProps = {
  bookId: string;
  onClose: () => void;
  onCreate: () => void;
  onDelete: (timeline: TimelineView) => void;
  onEdit: (timeline: TimelineView) => void;
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
  const tStates = useTranslations("timeline.states");
  const tToast = useTranslations("timeline.toast");

  const timelinesQuery = useBookTimelines(bookId);
  const reorderTimelines = useReorderTimelines();
  const setDefaultTimeline = useSetDefaultTimeline();
  const isBusy = reorderTimelines.isPending || setDefaultTimeline.isPending;

  const orderedTimelines = [...(timelinesQuery.data?.timelines ?? [])].sort(
    (first, second) => first.position - second.position,
  );

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

  function moveTimeline(index: number, direction: "down" | "up") {
    const timeline = orderedTimelines[index];
    if (timeline === undefined) return;

    const neighbor = direction === "up" ? orderedTimelines[index - 1] : orderedTimelines[index + 1];
    if (neighbor === undefined) return;

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

    reorderTimelines.mutate(
      { bookId, input },
      {
        onError: handleMutationError,
        onSuccess: () => toast.success(tToast("reordered")),
      },
    );
  }

  function makeDefault(timeline: TimelineView) {
    setDefaultTimeline.mutate(
      { bookId, input: { expectedUpdatedAt: timeline.updatedAt }, timelineId: timeline.id },
      {
        onError: handleMutationError,
        onSuccess: () => toast.success(tToast("defaultChanged")),
      },
    );
  }

  function renderBody() {
    if (timelinesQuery.data === undefined) {
      if (timelinesQuery.isError) {
        return (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border p-3">
            <p className="text-sm text-muted-foreground">{tStates("errorText")}</p>
            <Button
              onClick={() => void timelinesQuery.refetch()}
              size="sm"
              type="button"
              variant="secondary"
            >
              <UiIcon name="refresh" size={14} />
              {tStates("retry")}
            </Button>
          </div>
        );
      }

      return (
        <div aria-busy aria-label={t("loading")} className="flex flex-col gap-2" role="status">
          {Array.from({ length: MANAGE_SKELETON_ROWS }, (_, index) => (
            <Skeleton className="h-16 w-full rounded-lg" key={index} />
          ))}
        </div>
      );
    }

    if (orderedTimelines.length === 0) {
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

    return (
      <>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground tabular-nums">
            {t("lineCount", { count: orderedTimelines.length })}
          </span>
          <Button onClick={onCreate} size="sm" type="button" variant="outline">
            <UiIcon name="plus" size={16} />
            {tRoot("newLine")}
          </Button>
        </div>

        <ul className="flex max-h-[60vh] min-h-0 flex-col gap-2 overflow-x-hidden overflow-y-auto px-0.5 py-0.5">
          {orderedTimelines.map((timeline, index) => (
            <li
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-background p-3"
              key={timeline.id}
            >
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={markerStyle(timeline.colorKey)}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {timeline.name}
                  </span>
                  {timeline.isDefault ? (
                    <Badge className="shrink-0" variant="secondary">
                      {t("defaultBadge")}
                    </Badge>
                  ) : null}
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t("eventCount", { count: timeline.eventsCount })}
                </span>
              </div>

              <div className="order-last flex w-full shrink-0 items-center justify-end gap-1 sm:order-none sm:w-auto">
                <Button
                  aria-label={t("moveUp", { name: timeline.name })}
                  className="size-9"
                  disabled={index === 0 || isBusy}
                  onClick={() => moveTimeline(index, "up")}
                  size="icon-sm"
                  variant="ghost"
                >
                  <UiIcon name="arrow-up" size={16} />
                </Button>
                <Button
                  aria-label={t("moveDown", { name: timeline.name })}
                  className="size-9"
                  disabled={index === orderedTimelines.length - 1 || isBusy}
                  onClick={() => moveTimeline(index, "down")}
                  size="icon-sm"
                  variant="ghost"
                >
                  <UiIcon name="arrow-down" size={16} />
                </Button>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label={t("rowMenu", { name: timeline.name })}
                    className="size-9 shrink-0"
                    size="icon-sm"
                    variant="ghost"
                  >
                    <UiIcon name="more" size={18} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem onSelect={() => onEdit(timeline)}>
                    <UiIcon name="edit" size={16} />
                    {t("edit")}
                  </DropdownMenuItem>
                  {timeline.isDefault ? null : (
                    <DropdownMenuItem disabled={isBusy} onSelect={() => makeDefault(timeline)}>
                      <UiIcon name="star" size={16} />
                      {t("setDefault")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {timeline.isDefault ? (
                    <>
                      <DropdownMenuItem disabled variant="destructive">
                        <UiIcon name="trash" size={16} />
                        {t("delete")}
                      </DropdownMenuItem>
                      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                        {t("deleteDefaultHint")}
                      </DropdownMenuLabel>
                    </>
                  ) : (
                    <DropdownMenuItem onSelect={() => onDelete(timeline)} variant="destructive">
                      <UiIcon name="trash" size={16} />
                      {t("delete")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
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
        </DialogHeader>

        {renderBody()}

        <DialogFooter>
          <Button onClick={onClose} type="button" variant="secondary">
            {t("done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
