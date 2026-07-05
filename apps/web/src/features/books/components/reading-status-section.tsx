"use client";

import type { ReadingStatus } from "@app/shared";

import { useTranslations } from "next-intl";
import { type Control, Controller, type FieldErrors, useWatch } from "react-hook-form";

import { UiIcon } from "@/components/icons";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Rating } from "@/components/ui/rating";
import { Textarea } from "@/components/ui/textarea";
import { readingStatuses } from "@/lib/book-status";

import type { CreateBookFormValues } from "../model/create-book-form";

import { READING_STATUS_OPTIONS, readingProgressFieldsFor } from "../model/book-status-fields";
import { READING_STATUS_FIELDS } from "../model/section-completeness";
import { BookDateField } from "./book-date-field";
import { FormSection } from "./form-section";
import { StatusChipGroup } from "./status-chip-group";
import { useSectionCompletion } from "./use-section-completion";

const NOTE_MAX = 300;
const IMPRESSION_MAX = 500;
const CURRENT_PAGE_MAX = 100000;
const RATING_MAX = 10;

const readingStatusIcon = new Map(readingStatuses.map((entry) => [entry.value, entry.icon]));

type ProgressDateFieldProps = {
  ariaLabel: string;
  control: Control<CreateBookFormValues>;
  error?: { message?: string };
  id: string;
  label: string;
  name: ProgressDateName;
  placeholder: string;
};

type ProgressDateName =
  | "readingProgress.abandonedAt"
  | "readingProgress.finishedAt"
  | "readingProgress.pausedAt"
  | "readingProgress.startedAt";

type ProgressTextFieldProps = {
  control: Control<CreateBookFormValues>;
  error?: { message?: string };
  id: string;
  label: string;
  maxLength: number;
  name: ProgressTextName;
  placeholder: string;
};

type ProgressTextName = "readingProgress.impression" | "readingProgress.note";

type ReadingStatusSectionProps = {
  control: Control<CreateBookFormValues>;
  errors: FieldErrors<CreateBookFormValues>;
  initialPagesCount?: number;
  onRequestChange?: (next: ReadingStatus, apply: () => void) => void;
};

export function ReadingStatusSection({
  control,
  errors,
  initialPagesCount,
  onRequestChange,
}: ReadingStatusSectionProps) {
  const t = useTranslations("books");
  const tCommon = useTranslations("common");
  const status = useWatch({ control, name: "readingStatus" });
  const pagesCountValue = useWatch({
    control,
    defaultValue: initialPagesCount,
    name: "pagesCount",
  });
  const currentPageValue = useWatch({ control, name: "readingProgress.currentPage" });
  const currentPageExceeds =
    typeof pagesCountValue === "number" &&
    typeof currentPageValue === "number" &&
    currentPageValue > pagesCountValue;
  const fields = new Set(readingProgressFieldsFor(status ?? "not_started"));
  const progressErrors = errors.readingProgress;
  const complete = useSectionCompletion(control, READING_STATUS_FIELDS);

  return (
    <FormSection
      complete={complete}
      completeLabel={t("form.sectionComplete")}
      description={t("readingStatus.description")}
      icon="bookmark"
      title={t("readingStatus.title")}
    >
      <Controller
        control={control}
        name="readingStatus"
        render={({ field }) => (
          <StatusChipGroup
            label={t("readingStatus.title")}
            onValueChange={(next) => {
              const apply = () => field.onChange(next);
              if (onRequestChange) onRequestChange(next as ReadingStatus, apply);
              else apply();
            }}
            options={READING_STATUS_OPTIONS.map((value) => {
              const icon = readingStatusIcon.get(value);
              return {
                icon: icon ? <UiIcon name={icon} size={16} /> : undefined,
                label: t(`readingStatus.options.${value}`),
                value,
              };
            })}
            value={field.value ?? "not_started"}
          />
        )}
      />

      {fields.size === 0 ? null : (
        <div className="flex flex-col gap-4 rounded-md border border-border bg-secondary/40 p-4 motion-safe:animate-in motion-safe:duration-300 motion-safe:slide-in-from-top-1">
          {fields.has("currentPage") ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="reading-current-page">{t("readingStatus.fields.currentPage")}</Label>
              <Controller
                control={control}
                name="readingProgress.currentPage"
                render={({ field }) => (
                  <NumberStepper
                    ariaLabel={t("readingStatus.fields.currentPage")}
                    decrementLabel={tCommon("decrement")}
                    describedBy={
                      currentPageExceeds || progressErrors?.currentPage
                        ? "reading-current-page-error"
                        : undefined
                    }
                    incrementLabel={tCommon("increment")}
                    max={typeof pagesCountValue === "number" ? pagesCountValue : CURRENT_PAGE_MAX}
                    min={0}
                    onValueChange={field.onChange}
                    size="sm"
                    suffix={
                      typeof pagesCountValue === "number"
                        ? t("readingStatus.currentPageHint", { total: pagesCountValue })
                        : undefined
                    }
                    value={typeof field.value === "number" ? field.value : 0}
                  />
                )}
              />
              {currentPageExceeds ? (
                <p
                  className="text-xs text-destructive"
                  id="reading-current-page-error"
                  role="alert"
                >
                  {t("readingStatus.currentPageExceeds", { total: pagesCountValue ?? 0 })}
                </p>
              ) : (
                <FieldError error={progressErrors?.currentPage} id="reading-current-page-error" />
              )}
            </div>
          ) : null}

          {fields.has("rating") ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="reading-rating">{t("readingStatus.fields.rating")}</Label>
              <Controller
                control={control}
                name="readingProgress.rating"
                render={({ field }) => (
                  <Rating
                    aria-describedby={
                      errors.readingProgress?.rating ? "reading-rating-error" : undefined
                    }
                    label={t("readingStatus.fields.rating")}
                    max={RATING_MAX}
                    onValueChange={(next) =>
                      field.onChange(Math.max(0.5, Math.min(RATING_MAX, next)))
                    }
                    size="lg"
                    value={typeof field.value === "number" ? field.value : 0}
                  />
                )}
              />
              <FieldError error={progressErrors?.rating} id="reading-rating-error" />
            </div>
          ) : null}

          {fields.has("startedAt") ? (
            <ProgressDateField
              ariaLabel={t("readingStatus.fields.startedAt")}
              control={control}
              error={progressErrors?.startedAt}
              id="reading-started-at"
              label={t("readingStatus.fields.startedAt")}
              name="readingProgress.startedAt"
              placeholder={t("readingStatus.fields.datePlaceholder")}
            />
          ) : null}

          {fields.has("finishedAt") ? (
            <ProgressDateField
              ariaLabel={t("readingStatus.fields.finishedAt")}
              control={control}
              error={progressErrors?.finishedAt}
              id="reading-finished-at"
              label={t("readingStatus.fields.finishedAt")}
              name="readingProgress.finishedAt"
              placeholder={t("readingStatus.fields.datePlaceholder")}
            />
          ) : null}

          {fields.has("pausedAt") ? (
            <ProgressDateField
              ariaLabel={t("readingStatus.fields.pausedAt")}
              control={control}
              error={progressErrors?.pausedAt}
              id="reading-paused-at"
              label={t("readingStatus.fields.pausedAt")}
              name="readingProgress.pausedAt"
              placeholder={t("readingStatus.fields.datePlaceholder")}
            />
          ) : null}

          {fields.has("abandonedAt") ? (
            <ProgressDateField
              ariaLabel={t("readingStatus.fields.abandonedAt")}
              control={control}
              error={progressErrors?.abandonedAt}
              id="reading-abandoned-at"
              label={t("readingStatus.fields.abandonedAt")}
              name="readingProgress.abandonedAt"
              placeholder={t("readingStatus.fields.datePlaceholder")}
            />
          ) : null}

          {fields.has("impression") ? (
            <ProgressTextField
              control={control}
              error={progressErrors?.impression}
              id="reading-impression"
              label={t("readingStatus.fields.impression")}
              maxLength={IMPRESSION_MAX}
              name="readingProgress.impression"
              placeholder={t("readingStatus.fields.impressionPlaceholder")}
            />
          ) : null}

          {fields.has("note") ? (
            <ProgressTextField
              control={control}
              error={progressErrors?.note}
              id="reading-note"
              label={t("readingStatus.fields.note")}
              maxLength={NOTE_MAX}
              name="readingProgress.note"
              placeholder={t("readingStatus.fields.notePlaceholder")}
            />
          ) : null}
        </div>
      )}
    </FormSection>
  );
}

function ProgressDateField({
  ariaLabel,
  control,
  error,
  id,
  label,
  name,
  placeholder,
}: ProgressDateFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <BookDateField
            ariaLabel={ariaLabel}
            describedBy={error ? errorId : undefined}
            id={id}
            invalid={error !== undefined}
            onChange={field.onChange}
            placeholder={placeholder}
            value={field.value}
          />
        )}
      />
      {error?.message ? (
        <p className="text-xs text-destructive" id={errorId} role="alert">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}

function ProgressTextField({
  control,
  error,
  id,
  label,
  maxLength,
  name,
  placeholder,
}: ProgressTextFieldProps) {
  const counterId = `${id}-counter`;
  const errorId = `${id}-error`;
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const text = typeof field.value === "string" ? field.value : "";
        return (
          <div className="flex flex-col gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Textarea
              aria-describedby={counterId}
              aria-invalid={error !== undefined}
              id={id}
              maxLength={maxLength}
              onChange={(event) => field.onChange(event.target.value)}
              placeholder={placeholder}
              value={text}
            />
            <div className="flex items-center justify-between gap-2">
              {error?.message ? (
                <p className="text-xs text-destructive" id={errorId} role="alert">
                  {error.message}
                </p>
              ) : null}
              <span className="ml-auto text-xs text-muted-foreground tabular-nums" id={counterId}>
                {text.length}/{maxLength}
              </span>
            </div>
          </div>
        );
      }}
    />
  );
}
