"use client";

import type { Nullable, TimelineEventView, TimelineView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useMoveTimelineEvent } from "../api/use-move-timeline-event";
import { markerStyle } from "../model/color-key";
import { TimelineLineChip } from "./timeline-line-chip";

type MoveEventDialogProps = {
  bookId: string;
  event: Nullable<TimelineEventView>;
  onOpenChange: (open: boolean) => void;
  timelines: TimelineView[];
};

export function MoveEventDialog({ bookId, event, onOpenChange, timelines }: MoveEventDialogProps) {
  const t = useTranslations("timeline.moveDialog");

  return (
    <Dialog onOpenChange={onOpenChange} open={event !== null}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {event === null ? null : (
          <MoveEventForm
            bookId={bookId}
            event={event}
            onDone={() => onOpenChange(false)}
            timelines={timelines}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MoveEventForm({
  bookId,
  event,
  onDone,
  timelines,
}: {
  bookId: string;
  event: TimelineEventView;
  onDone: () => void;
  timelines: TimelineView[];
}) {
  const t = useTranslations("timeline.moveDialog");
  const tToast = useTranslations("timeline.toast");
  const moveEvent = useMoveTimelineEvent();

  const otherLines = timelines.filter((timeline) => timeline.id !== event.timelineId);
  const [targetTimelineId, setTargetTimelineId] = useState("");

  if (otherLines.length === 0) {
    return (
      <>
        <p className="text-sm text-muted-foreground">{t("noOtherLines")}</p>
        <DialogFooter>
          <Button onClick={onDone} type="button" variant="secondary">
            {t("cancel")}
          </Button>
        </DialogFooter>
      </>
    );
  }

  function submit() {
    moveEvent.mutate(
      {
        bookId,
        eventId: event.id,
        input: { expectedUpdatedAt: event.updatedAt, targetTimelineId },
      },
      {
        onError: () => toast.error(tToast("moveError")),
        onSuccess: () => {
          toast.success(tToast("moved"));
          onDone();
        },
      },
    );
  }

  return (
    <>
      <div className="flex flex-col items-start gap-2">
        <span className="text-sm leading-none font-medium text-muted-foreground">
          {t("currentLabel")}
        </span>
        <TimelineLineChip
          colorKey={event.timelineColorKey}
          name={event.timelineName}
          size="compact"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="move-event-target">{t("targetLabel")}</Label>
        <Select onValueChange={setTargetTimelineId} value={targetTimelineId}>
          <SelectTrigger
            className="h-10 w-full data-[size=default]:h-10 *:data-[slot=select-value]:*:line-clamp-1"
            id="move-event-target"
          >
            <SelectValue placeholder={t("targetPlaceholder")} />
          </SelectTrigger>
          <SelectContent className="max-h-64 max-w-(--radix-select-trigger-width)">
            {otherLines.map((timeline) => (
              <SelectItem key={timeline.id} value={timeline.id}>
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={markerStyle(timeline.colorKey)}
                />
                <span className="line-clamp-2 min-w-0">{timeline.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DialogFooter>
        <Button disabled={moveEvent.isPending} onClick={onDone} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button
          disabled={moveEvent.isPending || targetTimelineId === ""}
          loading={moveEvent.isPending}
          onClick={submit}
          type="button"
        >
          {moveEvent.isPending ? t("moving") : t("confirm")}
        </Button>
      </DialogFooter>
    </>
  );
}
