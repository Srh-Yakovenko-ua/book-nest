"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  type Control,
  Controller,
  type FieldErrors,
  type UseFormSetValue,
  useWatch,
} from "react-hook-form";

import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Segmented } from "@/components/ui/segmented";

import type { CreateBookFormValues, SeriesSelection } from "../model/create-book-form";

import { CreateSeriesDialog } from "./create-series-dialog";
import { FormSection } from "./form-section";
import { SeriesAutocomplete } from "./series-autocomplete";

const PART_NUMBER_MAX = 999;

type BookTypeSectionProps = {
  control: Control<CreateBookFormValues>;
  errors: FieldErrors<CreateBookFormValues>;
  initialSeries?: null | SeriesSelection;
  onRequestSoloChange?: (apply: () => void) => void;
  setValue: UseFormSetValue<CreateBookFormValues>;
};

export function BookTypeSection({
  control,
  errors,
  initialSeries = null,
  onRequestSoloChange,
  setValue,
}: BookTypeSectionProps) {
  const t = useTranslations("books");
  const bookType = useWatch({ control, name: "bookType" }) ?? "solo";
  const [seriesSelection, setSeriesSelection] = useState<null | SeriesSelection>(initialSeries);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingName, setPendingName] = useState("");

  function applySelection(selection: null | SeriesSelection) {
    setSeriesSelection(selection);
    if (selection === null) {
      setValue("seriesId", undefined);
      setValue("newSeries", undefined, { shouldValidate: true });
      return;
    }
    if (selection.kind === "existing") {
      setValue("newSeries", undefined);
      setValue("seriesId", selection.id, { shouldValidate: true });
      return;
    }
    setValue("seriesId", undefined);
    setValue("newSeries", selection.draft, { shouldValidate: true });
  }

  function applySolo() {
    setValue("bookType", "solo");
    setSeriesSelection(null);
    setValue("seriesId", undefined);
    setValue("newSeries", undefined);
    setValue("partNumber", undefined);
  }

  function handleBookTypeChange(next: string) {
    if (next === "series_part") {
      setValue("bookType", "series_part");
      setValue("partNumber", 1);
      return;
    }
    if (onRequestSoloChange && seriesSelection !== null) {
      onRequestSoloChange(applySolo);
      return;
    }
    applySolo();
  }

  const seriesErrorMessage =
    typeof errors.newSeries?.message === "string" ? errors.newSeries.message : undefined;

  return (
    <FormSection description={t("bookType.description")} icon="layers" title={t("bookType.title")}>
      <Controller
        control={control}
        name="bookType"
        render={({ field }) => (
          <Segmented
            block
            label={t("bookType.title")}
            onValueChange={handleBookTypeChange}
            options={[
              { label: t("bookType.options.solo"), value: "solo" },
              { label: t("bookType.options.series_part"), value: "series_part" },
            ]}
            value={field.value ?? "solo"}
          />
        )}
      />

      {bookType === "series_part" ? (
        <div className="flex flex-col gap-4 rounded-md border border-border bg-secondary/40 p-4 motion-safe:animate-in motion-safe:duration-300 motion-safe:slide-in-from-top-1">
          <div className="flex flex-col gap-2">
            <Label htmlFor="book-series">{t("bookType.series")}</Label>
            <SeriesAutocomplete
              describedBy={seriesErrorMessage ? "book-series-error" : undefined}
              id="book-series"
              invalid={seriesErrorMessage !== undefined}
              onChange={applySelection}
              onCreateRequest={(name) => {
                setPendingName(name);
                setDialogOpen(true);
              }}
              placeholder={t("bookType.seriesPlaceholder")}
              value={seriesSelection}
            />
            {seriesSelection?.kind === "new" ? (
              <p className="flex items-center gap-1.5 text-xs text-primary">
                {t("bookType.seriesDraft", { name: seriesSelection.name })}
              </p>
            ) : null}
            {seriesErrorMessage ? (
              <p className="text-xs text-destructive" id="book-series-error" role="alert">
                {seriesErrorMessage}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="book-part-number">{t("bookType.partNumber")}</Label>
            <Controller
              control={control}
              name="partNumber"
              render={({ field }) => (
                <NumberStepper
                  ariaLabel={t("bookType.partNumber")}
                  max={PART_NUMBER_MAX}
                  min={1}
                  onValueChange={field.onChange}
                  size="sm"
                  value={typeof field.value === "number" ? field.value : 1}
                />
              )}
            />
            <FieldError error={errors.partNumber} id="book-part-number-error" />
          </div>
        </div>
      ) : null}

      <CreateSeriesDialog
        initialName={pendingName}
        onConfirm={applySelection}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
      />
    </FormSection>
  );
}
