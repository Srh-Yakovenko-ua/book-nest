"use client";

import type {
  Nullable,
  ReorderTimelineEventInput,
  TimelineEventView,
  TimelineReorderScope,
} from "@app/shared";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ApiError } from "@/lib/http-client";

import { timelineKeys } from "../api/timeline-keys";
import { useReorderTimelineEvent } from "../api/use-reorder-timeline-event";

type EventActionsMenuProps = {
  bookId: string;
  canReorder: boolean;
  event: TimelineEventView;
  firstEventId: Nullable<string>;
  hasMorePages: boolean;
  isFirst: boolean;
  isLast: boolean;
  lastEventId: Nullable<string>;
  neighborDownId: Nullable<string>;
  neighborUpId: Nullable<string>;
  onDelete: () => void;
  onEdit: () => void;
  onMove: () => void;
  onView: () => void;
  reorderScope: TimelineReorderScope;
};

type ReorderNeighbor = Pick<ReorderTimelineEventInput, "afterEventId" | "beforeEventId">;

export function EventActionsMenu({
  bookId,
  canReorder,
  event,
  firstEventId,
  hasMorePages,
  isFirst,
  isLast,
  lastEventId,
  neighborDownId,
  neighborUpId,
  onDelete,
  onEdit,
  onMove,
  onView,
  reorderScope,
}: EventActionsMenuProps) {
  const t = useTranslations("timeline.actions");
  const tToast = useTranslations("timeline.toast");
  const queryClient = useQueryClient();
  const reorderEvent = useReorderTimelineEvent();

  function reorder(neighbor: ReorderNeighbor) {
    reorderEvent.mutate(
      {
        bookId,
        eventId: event.id,
        input: { ...neighbor, expectedUpdatedAt: event.updatedAt, scope: reorderScope },
      },
      {
        onError: (error) => {
          if (error instanceof ApiError && error.status === 409) {
            toast.error(tToast("reorderConflict"));
            void queryClient.invalidateQueries({ queryKey: timelineKeys.events(bookId) });
            return;
          }
          toast.error(tToast("reorderError"));
        },
        onSuccess: () => toast.success(tToast("reordered")),
      },
    );
  }

  const busy = reorderEvent.isPending;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t("menu")}
          className="size-8 rounded-lg border border-border bg-card text-muted-foreground hover:border-brand hover:text-brand"
          size="icon-sm"
          variant="ghost"
        >
          <UiIcon name="more" size={18} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={onView}>
          <UiIcon name="eye" size={16} />
          {t("view")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onEdit}>
          <UiIcon name="edit" size={16} />
          {t("edit")}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={busy || !canReorder || isFirst || neighborUpId === null}
          onSelect={() => {
            if (neighborUpId !== null) reorder({ beforeEventId: neighborUpId });
          }}
        >
          <UiIcon name="chevron-up" size={16} />
          {t("moveUp")}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={busy || !canReorder || isLast || neighborDownId === null}
          onSelect={() => {
            if (neighborDownId !== null) reorder({ afterEventId: neighborDownId });
          }}
        >
          <UiIcon name="chevron-down" size={16} />
          {t("moveDown")}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={busy || !canReorder || isFirst || firstEventId === null}
          onSelect={() => {
            if (firstEventId !== null) reorder({ beforeEventId: firstEventId });
          }}
        >
          <UiIcon name="arrow-up" size={16} />
          {t("moveToTop")}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={busy || !canReorder || isLast || hasMorePages || lastEventId === null}
          onSelect={() => {
            if (lastEventId !== null) reorder({ afterEventId: lastEventId });
          }}
        >
          <UiIcon name="arrow-down" size={16} />
          {t("moveToBottom")}
        </DropdownMenuItem>
        {canReorder ? null : (
          <DropdownMenuLabel className="font-normal whitespace-normal">
            {t("reorderDisabledHint")}
          </DropdownMenuLabel>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={onMove}>
          <UiIcon name="swap" size={16} />
          {t("moveToLine")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDelete} variant="destructive">
          <UiIcon name="trash" size={16} />
          {t("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
