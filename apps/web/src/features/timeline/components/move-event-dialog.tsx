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
import { cn } from "@/lib/utils";

import { useMoveTimelineEvent } from "../api/use-move-timeline-event";
import { markerClass } from "../model/color-key";

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
  const [targetTimelineId, setTargetTimelineId] = useState(otherLines[0]?.id ?? "");

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
      <div className="flex flex-col gap-2">
        <Label htmlFor="move-event-target">{t("targetLabel")}</Label>
        <Select onValueChange={setTargetTimelineId} value={targetTimelineId}>
          <SelectTrigger className="h-10 w-full data-[size=default]:h-10" id="move-event-target">
            <SelectValue placeholder={t("targetPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {otherLines.map((timeline) => (
              <SelectItem key={timeline.id} value={timeline.id}>
                <span
                  aria-hidden
                  className={cn("size-2 rounded-full", markerClass(timeline.colorKey))}
                />
                {timeline.name}
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
