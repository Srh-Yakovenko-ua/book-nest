"use client";

import type {
  TimelineEventRelationEntry,
  TimelineEventView,
  TimelineRelationType,
} from "@app/shared";

import { TimelineRelationTypeSchema } from "@app/shared";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useCreateEventRelation } from "../api/use-create-event-relation";
import { useDeleteEventRelation } from "../api/use-delete-event-relation";
import { useTimelineEvent } from "../api/use-timeline-event";
import { EventSearchSelect } from "./event-search-select";

type EventRelationEditorProps = {
  bookId: string;
  eventId: string;
};

export function EventRelationEditor({ bookId, eventId }: EventRelationEditorProps) {
  const t = useTranslations("timeline.form");
  const tRelation = useTranslations("timeline.relationType");
  const tInverse = useTranslations("timeline.relationTypeInverse");
  const tToast = useTranslations("timeline.toast");

  const detailQuery = useTimelineEvent(eventId);
  const createRelation = useCreateEventRelation();
  const deleteRelation = useDeleteEventRelation();

  const [relationType, setRelationType] = useState<TimelineRelationType>("related");

  const outgoing = detailQuery.data?.relations.outgoing ?? [];
  const incoming = detailQuery.data?.relations.incoming ?? [];
  const excludeIds = [eventId, ...outgoing.map((entry) => entry.event.id)];

  function addRelation(target: TimelineEventView) {
    createRelation.mutate(
      { bookId, eventId, input: { relationType, targetEventId: target.id } },
      {
        onError: () => toast.error(tToast("relationError")),
        onSuccess: () => toast.success(tToast("relationAdded")),
      },
    );
  }

  function removeRelation(entry: TimelineEventRelationEntry) {
    deleteRelation.mutate(
      { bookId, eventId, relationId: entry.id, targetEventId: entry.event.id },
      {
        onError: () => toast.error(tToast("relationError")),
        onSuccess: () => toast.success(tToast("relationRemoved")),
      },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="event-relation-type">{t("relationTypeLabel")}</Label>
        <Select
          onValueChange={(value) => setRelationType(value as TimelineRelationType)}
          value={relationType}
        >
          <SelectTrigger className="h-9 w-full data-[size=default]:h-9" id="event-relation-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TimelineRelationTypeSchema.options.map((option) => (
              <SelectItem key={option} value={option}>
                {tRelation(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <EventSearchSelect
          bookId={bookId}
          excludeIds={excludeIds}
          onSelect={addRelation}
          placeholder={t("relationTargetPlaceholder")}
        />
      </div>

      {outgoing.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("relationsEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {outgoing.map((entry) => (
            <li
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
              key={entry.id}
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-xs text-muted-foreground">
                  {tRelation(entry.relationType)}
                </span>
                <span className="truncate text-sm text-foreground">{entry.event.title}</span>
              </span>
              <Button
                aria-label={t("relationRemove")}
                disabled={deleteRelation.isPending}
                onClick={() => removeRelation(entry)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <UiIcon name="x" size={16} />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {incoming.length === 0 ? null : (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {t("relationsIncoming")}
          </span>
          <ul className="flex flex-col gap-1.5">
            {incoming.map((entry) => (
              <li
                className="flex flex-col rounded-lg border border-dashed border-border px-3 py-2"
                key={entry.id}
              >
                <span className="text-xs text-muted-foreground">
                  {tInverse(entry.relationType)}
                </span>
                <span className="truncate text-sm text-foreground">{entry.event.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
