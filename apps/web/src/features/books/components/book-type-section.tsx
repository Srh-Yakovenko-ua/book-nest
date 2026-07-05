"use client";

import { BOOK_PART_NUMBER_EXCEEDS_TOTAL_MESSAGE, BOOK_SERIES_REQUIRED_MESSAGE } from "@app/shared";
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
import { Link } from "@/i18n/navigation";

import type {
  AuthorSelection,
  CreateBookFormValues,
  SeriesPartNumberConflict,
  SeriesSelection,
} from "../model/create-book-form";

import { BOOK_TYPE_FIELDS } from "../model/section-completeness";
import { CreateSeriesDialog } from "./create-series-dialog";
import { FormSection } from "./form-section";
import { SeriesAutocomplete } from "./series-autocomplete";
import { useSectionCompletion } from "./use-section-completion";

const PART_NUMBER_MAX = 999;

type BookTypeSectionProps = {
  authorSelections: AuthorSelection[];
  control: Control<CreateBookFormValues>;
  errors: FieldErrors<CreateBookFormValues>;
  onRequestSoloChange?: (apply: () => void) => void;
  onSeriesSelectionChange: (selection: null | SeriesSelection) => void;
  seriesCleared: boolean;
  seriesConflict: null | SeriesPartNumberConflict;
  seriesSelection: null | SeriesSelection;
  setValue: UseFormSetValue<CreateBookFormValues>;
};

export function BookTypeSection({
  authorSelections,
  control,
  errors,
  onRequestSoloChange,
  onSeriesSelectionChange,
  seriesCleared,
  seriesConflict,
  seriesSelection,
  setValue,
}: BookTypeSectionProps) {
  const t = useTranslations("books");
  const tCommon = useTranslations("common");
  const bookType = useWatch({ control, name: "bookType" }) ?? "solo";
  const partNumberValue = useWatch({ control, name: "partNumber" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingName, setPendingName] = useState("");
  const complete = useSectionCompletion(control, BOOK_TYPE_FIELDS);

  const selectedTotalBooks = seriesTotalBooks(seriesSelection);

  function applySelection(selection: null | SeriesSelection) {
    onSeriesSelectionChange(selection);
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
    onSeriesSelectionChange(null);
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

  const rawSeriesError =
    typeof errors.newSeries?.message === "string" ? errors.newSeries.message : undefined;
  const seriesRequired = rawSeriesError === BOOK_SERIES_REQUIRED_MESSAGE;
  const seriesOtherError =
    rawSeriesError !== undefined && !seriesRequired ? rawSeriesError : undefined;
  const showSeriesError = !seriesCleared && (seriesRequired || seriesOtherError !== undefined);

  function renderPartNumberError() {
    if (seriesConflict && seriesConflict.partNumber === partNumberValue) {
      return (
        <p className="text-xs text-destructive" id="book-part-number-error" role="alert">
          {t.rich("bookType.errors.partNumberTaken", {
            link: (chunks) => (
              <Link
                className="font-medium underline underline-offset-2"
                href={`/books/${seriesConflict.bookId}/edit`}
                rel="noopener noreferrer"
                target="_blank"
              >
                {chunks}
              </Link>
            ),
            number: seriesConflict.partNumber,
            title: seriesConflict.bookTitle,
          })}
        </p>
      );
    }
    if (errors.partNumber?.message === BOOK_PART_NUMBER_EXCEEDS_TOTAL_MESSAGE) {
      return (
        <p className="text-xs text-destructive" id="book-part-number-error" role="alert">
          {t("bookType.errors.exceedsTotal")}
        </p>
      );
    }
    return <FieldError error={errors.partNumber} id="book-part-number-error" />;
  }

  return (
    <FormSection
      complete={complete}
      completeLabel={t("form.sectionComplete")}
      description={t("bookType.description")}
      icon="layers"
      title={t("bookType.title")}
    >
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
              authorSelections={authorSelections}
              describedBy={showSeriesError ? "book-series-error" : undefined}
              id="book-series"
              invalid={showSeriesError}
              label={t("bookType.series")}
              onChange={applySelection}
              onCreateRequest={(name) => {
                setPendingName(name);
                setDialogOpen(true);
              }}
              placeholder={t("bookType.seriesPlaceholder")}
              value={seriesSelection}
            />
            {seriesCleared ? (
              <p className="text-xs text-warning" role="status">
                {t("bookType.errors.seriesClearedAfterAuthorChange")}
              </p>
            ) : seriesSelection?.kind === "new" ? (
              <p className="flex items-center gap-1.5 text-xs text-primary">
                {t("bookType.seriesDraft", { name: seriesSelection.name })}
              </p>
            ) : seriesRequired ? (
              <p className="text-xs text-destructive" id="book-series-error" role="alert">
                {t("bookType.errors.seriesRequired")}
              </p>
            ) : seriesOtherError ? (
              <p className="text-xs text-destructive" id="book-series-error" role="alert">
                {seriesOtherError}
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
                  decrementLabel={tCommon("decrement")}
                  incrementLabel={tCommon("increment")}
                  max={PART_NUMBER_MAX}
                  min={1}
                  onValueChange={field.onChange}
                  size="sm"
                  value={typeof field.value === "number" ? field.value : 1}
                />
              )}
            />
            {selectedTotalBooks !== undefined ? (
              <p className="text-xs text-muted-foreground">
                {t("bookType.partNumberHint", { total: selectedTotalBooks })}
              </p>
            ) : null}
            {renderPartNumberError()}
          </div>
        </div>
      ) : null}

      <CreateSeriesDialog
        authorSelections={authorSelections}
        initialName={pendingName}
        onConfirm={applySelection}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
      />
    </FormSection>
  );
}

function seriesTotalBooks(selection: null | SeriesSelection): number | undefined {
  if (selection === null) return undefined;
  if (selection.kind === "new") return selection.draft.totalBooks;
  return selection.totalBooks;
}
