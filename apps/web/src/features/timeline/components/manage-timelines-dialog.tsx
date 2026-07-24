"use client";

import type { ReorderTimelinesInput, TimelineView } from "@app/shared";

import { TIMELINE_ERROR_CODES } from "@app/shared";
import { useQueryClient } from "@tanstack/react-query";
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
import { ApiError } from "@/lib/http-client";
import { cn } from "@/lib/utils";

import { timelineKeys } from "../api/timeline-keys";
import { useReorderTimelines } from "../api/use-reorder-timelines";
import { useSetDefaultTimeline } from "../api/use-set-default-timeline";
import { markerClass } from "../model/color-key";

type ManageTimelinesDialogProps = {
  bookId: string;
  onCreate: () => void;
  onDelete: (timeline: TimelineView) => void;
  onEdit: (timeline: TimelineView) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  timelines: TimelineView[];
};

export function ManageTimelinesDialog({
  bookId,
  onCreate,
  onDelete,
  onEdit,
  onOpenChange,
  open,
  timelines,
}: ManageTimelinesDialogProps) {
  const t = useTranslations("timeline.manage");
  const tRoot = useTranslations("timeline");
  const tToast = useTranslations("timeline.toast");

  const queryClient = useQueryClient();
  const reorderTimelines = useReorderTimelines();
  const setDefaultTimeline = useSetDefaultTimeline();
  const isBusy = reorderTimelines.isPending || setDefaultTimeline.isPending;

  const orderedTimelines = [...timelines].sort((a, b) => a.position - b.position);

  function handleMutationError(error: unknown) {
    if (
      error instanceof ApiError &&
      (error.status === 409 || error.code === TIMELINE_ERROR_CODES.reorderConflict)
    ) {
      toast.error(tToast("reorderConflict"));
      void queryClient.invalidateQueries({ queryKey: timelineKeys.timelines(bookId) });
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

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <ul className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto px-0.5 py-0.5">
          {orderedTimelines.map((timeline, index) => (
            <li
              className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
              key={timeline.id}
            >
              <span
                aria-hidden
                className={cn("size-2.5 shrink-0 rounded-full", markerClass(timeline.colorKey))}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {timeline.name}
                  </span>
                  {timeline.isDefault ? (
                    <Badge variant="secondary">{t("defaultBadge")}</Badge>
                  ) : null}
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t("eventCount", { count: timeline.eventsCount })}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  aria-label={t("moveUp")}
                  className="size-8"
                  disabled={index === 0 || isBusy}
                  onClick={() => moveTimeline(index, "up")}
                  size="icon-sm"
                  variant="ghost"
                >
                  <UiIcon name="arrow-up" size={16} />
                </Button>
                <Button
                  aria-label={t("moveDown")}
                  className="size-8"
                  disabled={index === orderedTimelines.length - 1 || isBusy}
                  onClick={() => moveTimeline(index, "down")}
                  size="icon-sm"
                  variant="ghost"
                >
                  <UiIcon name="arrow-down" size={16} />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      aria-label={t("rowMenu")}
                      className="size-8"
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
              </div>
            </li>
          ))}
        </ul>

        <DialogFooter className="sm:justify-between">
          <Button onClick={onCreate} type="button" variant="outline">
            <UiIcon name="plus" size={16} />
            {tRoot("newLine")}
          </Button>
          <Button onClick={() => onOpenChange(false)} type="button" variant="secondary">
            {t("done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
