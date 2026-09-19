"use client";

import type { NoteSeriesPreview } from "@app/shared";

import { useTranslations } from "next-intl";
import { Controller } from "react-hook-form";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { SeriesSingleSelectPicker } from "@/features/series/components/series-single-select-picker";
import { SeriesSingleSelectValue } from "@/features/series/components/series-single-select-value";
import { cn } from "@/lib/utils";

import type { NoteFormControl, NoteFormErrors } from "../model/note-form-schema";
import type { NoteLocation } from "../model/note-location";

import { noteEntityRefFromSeries } from "../model/note-entity-options";
import { noteLocationLine } from "../model/note-location";
import { NOTE_FORM_FIELD_IDS } from "./note-form-field-ids";

export function SeriesNoteLinkedEntity({ series }: { series: NoteSeriesPreview }) {
  return <SeriesSingleSelectValue series={series} />;
}

export function SeriesNotePickerField({
  control,
  error,
}: {
  control: NoteFormControl;
  error: NoteFormErrors["entity"];
}) {
  const t = useTranslations("notes.form.seriesPicker");

  return (
    <Controller
      control={control}
      name="entity"
      render={({ field }) => (
        <SeriesSingleSelectPicker
          describedBy={error === undefined ? undefined : NOTE_FORM_FIELD_IDS.entityError}
          id={NOTE_FORM_FIELD_IDS.entity}
          invalid={error !== undefined}
          labelledBy={NOTE_FORM_FIELD_IDS.entityLabel}
          labels={{
            change: t("change"),
            collapse: t("collapse"),
            empty: t("empty"),
            loadError: t("loadError"),
            loading: t("loading"),
            loadMoreError: t("loadMoreError"),
            results: t("results"),
            resultsCount: (count) => t("resultsCount", { count }),
            retry: t("retry"),
            search: t("search"),
          }}
          onChange={(series) => field.onChange(noteEntityRefFromSeries(series))}
          ref={field.ref}
          required
          value={field.value?.type === "series" ? field.value.series : null}
        />
      )}
    />
  );
}

export function SeriesNoteSavedLocationField({
  control,
  location,
}: {
  control: NoteFormControl;
  location: NoteLocation;
}) {
  const t = useTranslations("notes");
  const line = noteLocationLine(location, (page) => t("card.page", { page }));

  if (line === null) return null;

  return (
    <Controller
      control={control}
      name="isSavedLocationRemoved"
      render={({ field }) => (
        <section
          aria-labelledby={NOTE_FORM_FIELD_IDS.savedLocationTitle}
          className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/40 p-3"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3
              className="text-sm font-medium text-foreground"
              id={NOTE_FORM_FIELD_IDS.savedLocationTitle}
            >
              {t("form.savedLocation.title")}
            </h3>
            <p
              className={cn(
                "text-sm wrap-anywhere whitespace-pre-line",
                field.value ? "text-muted-foreground line-through" : "text-foreground",
              )}
            >
              {line}
            </p>
            <p aria-live="polite" className="text-xs text-muted-foreground">
              {field.value ? t("form.savedLocation.removed") : t("form.savedLocation.description")}
            </p>
          </div>
          <Button
            className="self-start"
            onClick={() => field.onChange(!field.value)}
            size="sm"
            type="button"
            variant="ghost"
          >
            <UiIcon name={field.value ? "refresh" : "x"} size={14} />
            {field.value ? t("form.savedLocation.restore") : t("form.savedLocation.remove")}
          </Button>
        </section>
      )}
    />
  );
}
