"use client";

import type { DeleteTimelineQuery, TimelineDeleteStrategy, TimelineView } from "@app/shared";

import { TimelineDeleteStrategySchema } from "@app/shared";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { useDeleteTimeline } from "../api/use-delete-timeline";
import { markerStyle } from "../model/color-key";

type DeleteTimelineDialogProps = {
  bookId: string;
  onClose: () => void;
  onDeleted: (deletedTimelineId: string) => void;
  timeline: TimelineView;
  timelines: TimelineView[];
};

export function DeleteTimelineDialog({
  bookId,
  onClose,
  onDeleted,
  timeline,
  timelines,
}: DeleteTimelineDialogProps) {
  const t = useTranslations("timeline.manage");

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("deleteTitle")}</DialogTitle>
          <DialogDescription>
            {timeline.eventsCount === 0
              ? t("deleteEmptyDescription")
              : t("eventCountLine", { count: timeline.eventsCount })}
          </DialogDescription>
        </DialogHeader>
        <DeleteTimelineForm
          bookId={bookId}
          onCancel={onClose}
          onDeleted={onDeleted}
          timeline={timeline}
          timelines={timelines}
        />
      </DialogContent>
    </Dialog>
  );
}

function DeleteTimelineForm({
  bookId,
  onCancel,
  onDeleted,
  timeline,
  timelines,
}: {
  bookId: string;
  onCancel: () => void;
  onDeleted: (deletedTimelineId: string) => void;
  timeline: TimelineView;
  timelines: TimelineView[];
}) {
  const t = useTranslations("timeline.manage");
  const tStates = useTranslations("timeline.states");
  const tToast = useTranslations("timeline.toast");

  const deleteTimeline = useDeleteTimeline();
  const otherLines = timelines
    .filter((line) => line.id !== timeline.id)
    .sort((first, second) => first.position - second.position);
  const preselectedTarget = otherLines.find((line) => line.isDefault) ?? otherLines[0];

  const [strategy, setStrategy] = useState<TimelineDeleteStrategy>(
    preselectedTarget === undefined ? "delete" : "move",
  );
  const [targetTimelineId, setTargetTimelineId] = useState(preselectedTarget?.id ?? "");
  const [confirmDeleteEvents, setConfirmDeleteEvents] = useState(false);

  const isDeleting = deleteTimeline.isPending;
  const hasEvents = timeline.eventsCount > 0;

  function submit(query?: DeleteTimelineQuery) {
    deleteTimeline.mutate(
      { bookId, query, timelineId: timeline.id },
      {
        onError: () => toast.error(tToast("lineError")),
        onSuccess: () => {
          toast.success(tToast("lineDeleted"));
          onDeleted(timeline.id);
        },
      },
    );
  }

  if (!hasEvents) {
    return (
      <DialogFooter>
        <Button disabled={isDeleting} onClick={onCancel} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button
          disabled={isDeleting}
          loading={isDeleting}
          onClick={() => submit(undefined)}
          type="button"
          variant="destructive"
        >
          {isDeleting ? tStates("deleting") : t("confirmDelete")}
        </Button>
      </DialogFooter>
    );
  }

  const canConfirm = strategy === "move" ? targetTimelineId !== "" : confirmDeleteEvents;

  function confirm() {
    if (strategy === "move") {
      submit({ strategy: "move", targetTimelineId });
      return;
    }
    submit({ strategy: "delete" });
  }

  return (
    <>
      <RadioGroup
        disabled={isDeleting}
        onValueChange={(value) => {
          const parsed = TimelineDeleteStrategySchema.safeParse(value);
          if (parsed.success) setStrategy(parsed.data);
        }}
        value={strategy}
      >
        {otherLines.length > 0 ? (
          <div
            className={cn(
              "rounded-lg border p-3 transition-colors",
              strategy === "move" ? "border-brand bg-brand/5" : "border-border",
            )}
          >
            <div className="flex items-start gap-3">
              <RadioGroupItem className="mt-0.5" id="delete-strategy-move" value="move" />
              <div className="flex flex-col gap-0.5">
                <Label className="cursor-pointer font-medium" htmlFor="delete-strategy-move">
                  {t("strategyMove")}
                </Label>
                <p className="text-xs text-muted-foreground">{t("strategyMoveDescription")}</p>
              </div>
            </div>
            {strategy === "move" ? (
              <div className="mt-3 flex flex-col gap-2 pl-7">
                <Label htmlFor="delete-move-target">{t("targetLineLabel")}</Label>
                <Select
                  disabled={isDeleting}
                  onValueChange={setTargetTimelineId}
                  value={targetTimelineId}
                >
                  <SelectTrigger
                    className="h-10 w-full data-[size=default]:h-10"
                    id="delete-move-target"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {otherLines.map((line) => (
                      <SelectItem key={line.id} value={line.id}>
                        <span
                          aria-hidden
                          className="size-2 rounded-full"
                          style={markerStyle(line.colorKey)}
                        />
                        {line.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
        ) : null}

        <div
          className={cn(
            "rounded-lg border p-3 transition-colors",
            strategy === "delete" ? "border-destructive bg-destructive/5" : "border-border",
          )}
        >
          <div className="flex items-start gap-3">
            <RadioGroupItem className="mt-0.5" id="delete-strategy-delete" value="delete" />
            <div className="flex flex-col gap-0.5">
              <Label
                className="cursor-pointer font-medium text-destructive"
                htmlFor="delete-strategy-delete"
              >
                {t("strategyDelete")}
              </Label>
              <p className="text-xs text-muted-foreground">{t("strategyDeleteDescription")}</p>
            </div>
          </div>
          {strategy === "delete" ? (
            <label
              className="mt-3 flex cursor-pointer items-center gap-2 pl-7"
              htmlFor="delete-confirm-events"
            >
              <Checkbox
                checked={confirmDeleteEvents}
                disabled={isDeleting}
                id="delete-confirm-events"
                onCheckedChange={(value) => setConfirmDeleteEvents(value === true)}
              />
              <span className="text-sm text-foreground">{t("deleteConfirmCheckbox")}</span>
            </label>
          ) : null}
        </div>
      </RadioGroup>

      <DialogFooter>
        <Button disabled={isDeleting} onClick={onCancel} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button
          disabled={!canConfirm || isDeleting}
          loading={isDeleting}
          onClick={confirm}
          type="button"
          variant="destructive"
        >
          {isDeleting ? tStates("deleting") : t("confirmDelete")}
        </Button>
      </DialogFooter>
    </>
  );
}
