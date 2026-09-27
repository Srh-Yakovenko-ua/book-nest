"use client";

import type {
  TimelineEventRelationEntry,
  TimelineEventView,
  TimelineRelationType,
} from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";

import { useCreateEventRelation } from "../api/use-create-event-relation";
import { useDeleteEventRelation } from "../api/use-delete-event-relation";
import { useTimelineEvent } from "../api/use-timeline-event";
import { TimelineEventSingleSelectPicker } from "./timeline-event-single-select-picker";

const RELATION_CHIP_ORDER = [
  "related",
  "follows_from",
  "foreshadows",
] as const satisfies readonly TimelineRelationType[];

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
      <p className="text-xs text-muted-foreground">{t("relationsInstantSaveHint")}</p>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">{t("relationTypeLabel")}</span>
        <ChipGroup
          className="gap-2"
          label={t("relationTypeLabel")}
          mode="single"
          onValueChange={(value) => {
            const next = RELATION_CHIP_ORDER.find((option) => option === value);
            if (next === undefined) return;
            setRelationType(next);
          }}
          options={RELATION_CHIP_ORDER.map((option) => ({
            label: tRelation(option),
            value: option,
          }))}
          size="sm"
          value={relationType}
        />
        <TimelineEventSingleSelectPicker
          bookId={bookId}
          excludeIds={excludeIds}
          onSelect={addRelation}
          searchLabel={t("relationTargetPlaceholder")}
          selectedId={null}
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
                <RelationRowMeta entry={entry} />
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
                <RelationRowMeta entry={entry} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RelationRowMeta({ entry }: { entry: TimelineEventRelationEntry }) {
  const t = useTranslations("timeline");
  const { chapter, pageNumber, timelineName } = entry.event;

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
      <span className="truncate">{timelineName}</span>
      {chapter === null ? null : <span className="truncate">{chapter}</span>}
      {pageNumber === null ? null : (
        <span className="tabular-nums">{t("list.page", { page: pageNumber })}</span>
      )}
    </span>
  );
}
