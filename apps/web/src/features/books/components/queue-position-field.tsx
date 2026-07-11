"use client";

import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Segmented } from "@/components/ui/segmented";

import type {
  QueueOutcome,
  QueuePickerItem,
  QueuePlacementChoice,
  QueueRelativeSide,
} from "../model/queue-placement";

import {
  isQueuePlacementChoice,
  isQueueRelativeSide,
  QUEUE_PLACEMENT_OPTIONS,
} from "../model/queue-placement";
import { QueueRelativeBookPicker } from "./queue-relative-book-picker";

type QueuePositionFieldProps = {
  candidates: QueuePickerItem[];
  disabled?: boolean;
  error?: string;
  idPrefix?: string;
  maxPosition: number;
  onPlacementChange: (placement: QueuePlacementChoice) => void;
  onPositionChange: (value: string) => void;
  onRelativeBookChange: (bookId: string) => void;
  onRelativeSideChange: (side: QueueRelativeSide) => void;
  outcome: null | QueueOutcome;
  placement: QueuePlacementChoice;
  position: string;
  queueLength: number;
  relativeBookId: null | string;
  relativeSide: QueueRelativeSide;
};

export function QueuePositionField({
  candidates,
  disabled = false,
  error,
  idPrefix = "queue-position",
  maxPosition,
  onPlacementChange,
  onPositionChange,
  onRelativeBookChange,
  onRelativeSideChange,
  outcome,
  placement,
  position,
  queueLength,
  relativeBookId,
  relativeSide,
}: QueuePositionFieldProps) {
  const t = useTranslations("readingQueue.position");
  const positionId = `${idPrefix}-value`;
  const errorId = `${idPrefix}-error`;
  const options =
    candidates.length === 0 ? QUEUE_PLACEMENT_OPTIONS.slice(0, 3) : QUEUE_PLACEMENT_OPTIONS;

  function handlePositionChange(raw: string) {
    if (raw === "") return onPositionChange("");
    if (!/^\d+$/.test(raw)) return;
    onPositionChange(Number(raw) > maxPosition ? String(maxPosition) : raw);
  }

  if (queueLength === 0) {
    return <ResultPreview outcome={outcome} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium text-foreground">{t("legend")}</span>
      <RadioGroup
        aria-label={t("legend")}
        disabled={disabled}
        onValueChange={(value) => {
          if (isQueuePlacementChoice(value)) onPlacementChange(value);
        }}
        value={placement}
      >
        {options.map((option) => (
          <Label
            className="cursor-pointer items-start gap-2.5 font-normal"
            htmlFor={`${idPrefix}-${option}`}
            key={option}
          >
            <RadioGroupItem className="mt-0.5" id={`${idPrefix}-${option}`} value={option} />
            <span className="text-sm text-foreground">{t(option)}</span>
          </Label>
        ))}
      </RadioGroup>

      {placement === "specific" ? (
        <div className="flex flex-col gap-2 pl-6">
          <Label htmlFor={positionId}>{t("positionLabel")}</Label>
          <Input
            aria-describedby={error ? `${errorId} ${idPrefix}-helper` : `${idPrefix}-helper`}
            aria-invalid={error !== undefined}
            aria-required
            className="w-28"
            disabled={disabled}
            id={positionId}
            inputMode="numeric"
            max={maxPosition}
            onChange={(event) => handlePositionChange(event.target.value)}
            placeholder={t("rangePlaceholder", { max: maxPosition })}
            required
            type="text"
            value={position}
          />
          <p className="text-xs text-muted-foreground" id={`${idPrefix}-helper`}>
            {t("specificHelper")}
          </p>
          {error === undefined ? null : (
            <p className="text-xs text-destructive" id={errorId} role="alert">
              {error}
            </p>
          )}
        </div>
      ) : null}

      {placement === "relative" ? (
        <div className="flex flex-col gap-2.5 pl-6">
          <QueueRelativeBookPicker
            candidates={candidates}
            disabled={disabled}
            emptyLabel={t("relativeBookEmpty")}
            id={`${idPrefix}-relative-book`}
            onChange={onRelativeBookChange}
            placeholder={t("relativeBookPlaceholder")}
            rowLabel={(item) => t("relativeRow", { position: item.position, title: item.title })}
            searchPlaceholder={t("relativeBookSearch")}
            triggerLabel={t("relativeBookLabel")}
            value={relativeBookId}
          />
          <Segmented
            className="self-start"
            label={t("relativeSideLabel")}
            onValueChange={(value) => {
              if (isQueueRelativeSide(value)) onRelativeSideChange(value);
            }}
            options={[
              { label: t("relativeBefore"), value: "before" },
              { label: t("relativeAfter"), value: "after" },
            ]}
            tone="accent"
            value={relativeSide}
          />
        </div>
      ) : null}

      <ResultPreview outcome={outcome} />
    </div>
  );
}

function ResultPreview({ outcome }: { outcome: null | QueueOutcome }) {
  const t = useTranslations("readingQueue.position");
  const wrap = (text: string) => <p className="text-xs text-muted-foreground">{text}</p>;

  if (outcome === null) return null;
  switch (outcome.kind) {
    case "end":
      return wrap(t("resultEnd", { position: outcome.position }));
    case "first":
      return wrap(t("resultFirst"));
    case "relative":
      return wrap(
        outcome.side === "before"
          ? t("resultRelativeBefore", { position: outcome.position, title: outcome.title })
          : t("resultRelativeAfter", { position: outcome.position, title: outcome.title }),
      );
    case "specific":
      return wrap(t("resultSpecific", { position: outcome.position }));
  }
}
