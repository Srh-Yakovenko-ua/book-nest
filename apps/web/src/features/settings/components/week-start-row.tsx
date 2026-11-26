"use client";

import type { WeekStartDay } from "@app/shared";

import { WeekStartDaySchema } from "@app/shared";
import { useLocale, useTranslations } from "next-intl";
import { useId, useRef } from "react";

import { Segmented } from "@/components/ui/segmented";

import { useAutosaveField } from "../hooks/use-autosave-field";
import { weekdayPreview } from "../model/weekday-preview";
import { FieldSaveStatus } from "./field-save-status";

const WEEK_START_OPTIONS: readonly WeekStartDay[] = ["monday", "sunday"];

export function WeekStartRow({ weekStartDay }: { weekStartDay: WeekStartDay }) {
  const t = useTranslations("settings.regional.weekStartDay");
  const generatedId = useId();
  const segmentedRef = useRef<HTMLDivElement>(null);
  const weekStartField = useAutosaveField({
    confirmed: weekStartDay,
    fromInput: (input) => input.weekStartDay,
    toInput: (next) => ({ weekStartDay: next }),
  });

  const labelId = `settings-week-start-label-${generatedId}`;
  const hintId = `settings-week-start-hint-${generatedId}`;
  const isSaving = weekStartField.status === "saving";

  function retry() {
    segmentedRef.current?.focus();
    weekStartField.retry();
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
        <p className="text-sm leading-none font-medium" id={labelId}>
          {t("label")}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground" id={hintId}>
          {t("hint")}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Segmented
          aria-describedby={hintId}
          aria-disabled={isSaving}
          className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          label={t("label")}
          onValueChange={(next) => {
            if (isWeekStartDay(next)) weekStartField.save(next);
          }}
          options={WEEK_START_OPTIONS.map((option) => ({
            label: t(option),
            value: option,
          }))}
          ref={segmentedRef}
          value={weekStartField.value}
        />
        <WeekdayPreviewList weekStartDay={weekStartField.value} />
      </div>
      <FieldSaveStatus
        className="basis-full"
        fieldLabelId={labelId}
        onRetry={retry}
        status={weekStartField.status}
      />
    </div>
  );
}

function isWeekStartDay(value: string): value is WeekStartDay {
  return WeekStartDaySchema.safeParse(value).success;
}

function WeekdayPreviewList({ weekStartDay }: { weekStartDay: WeekStartDay }) {
  const t = useTranslations("settings.regional.weekStartDay");
  const language = useLocale();
  const weekdays = weekdayPreview({ language, now: new Date(), weekStartDay });

  return (
    <ol aria-label={t("preview")} className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
      {weekdays.map((weekday) => (
        <li className="first:font-medium first:text-foreground" key={weekday.long}>
          <span aria-hidden>{weekday.short}</span>
          <span className="sr-only">{weekday.long}</span>
        </li>
      ))}
    </ol>
  );
}
