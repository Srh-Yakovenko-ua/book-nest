"use client";

import type { BookView, ChangeReadingStatusInput, ReadingStatus } from "@app/shared";

import { ReadingStatusSchema } from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { UiIcon } from "@/components/icons";
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
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Rating } from "@/components/ui/rating";
import { Textarea } from "@/components/ui/textarea";
import { readingStatuses } from "@/lib/book-status";
import { ApiError } from "@/lib/http-client";

import { useChangeReadingStatus } from "../api/use-reading-progress";
import {
  ISO_DATE_PATTERN,
  READING_CURRENT_PAGE_CEILING,
  todayIso,
} from "../model/reading-progress";
import { BookDateField } from "./book-date-field";
import { StatusChipGroup } from "./status-chip-group";

const NOTE_MAX = 300;
const IMPRESSION_MAX = 5000;
const RATING_MAX = 10;

type ChangeReadingStatusDialogProps = {
  book: BookView;
  defaultStatus?: ReadingStatus;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type ChangeStatusValues = {
  currentPage: number;
  date: string;
  impression: string;
  note: string;
  rating: number;
  resetProgress: boolean;
  status: ReadingStatus;
};

type StatusFields = {
  currentPage: boolean;
  date: boolean;
  impression: boolean;
  note: boolean;
  rating: boolean;
  reason: boolean;
  resetProgress: boolean;
};

export function ChangeReadingStatusDialog({
  book,
  defaultStatus,
  onOpenChange,
  open,
}: ChangeReadingStatusDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <ChangeStatusForm
            book={book}
            defaultStatus={defaultStatus}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function buildPayload({
  fields,
  values,
}: {
  fields: StatusFields;
  values: ChangeStatusValues;
}): ChangeReadingStatusInput {
  const payload: ChangeReadingStatusInput = { status: values.status };
  if (fields.date) payload.date = values.date;
  if (fields.currentPage && values.currentPage > 0) payload.currentPage = values.currentPage;
  if ((fields.note || fields.reason) && values.note.trim().length > 0) {
    payload.note = values.note.trim();
  }
  if (fields.impression && values.impression.trim().length > 0) {
    payload.impression = values.impression.trim();
  }
  if (fields.rating && values.rating > 0) payload.rating = values.rating;
  if (fields.resetProgress && values.resetProgress) payload.resetProgress = true;
  return payload;
}

function buildSchema(messages: {
  dateFuture: string;
  dateInvalid: string;
  impressionMax: string;
  noteMax: string;
  pageOverTotal: string;
}) {
  return z.object({
    currentPage: z.number().int().min(0).max(READING_CURRENT_PAGE_CEILING, messages.pageOverTotal),
    date: z
      .string()
      .refine((value) => ISO_DATE_PATTERN.test(value), messages.dateInvalid)
      .refine((value) => value <= todayIso(), messages.dateFuture),
    impression: z.string().max(IMPRESSION_MAX, messages.impressionMax),
    note: z.string().max(NOTE_MAX, messages.noteMax),
    rating: z.literal(0).or(z.number().min(0.5).max(RATING_MAX).multipleOf(0.5)),
    resetProgress: z.boolean(),
    status: ReadingStatusSchema,
  });
}

function ChangeStatusForm({
  book,
  defaultStatus,
  onDone,
}: {
  book: BookView;
  defaultStatus?: ReadingStatus;
  onDone: () => void;
}) {
  const t = useTranslations("books.details.reading");
  const tOptions = useTranslations("books.readingStatus.options");
  const tFields = useTranslations("books.readingStatus.fields");
  const tActions = useTranslations("books.actions");
  const tCommon = useTranslations("common");
  const change = useChangeReadingStatus();
  const [serverError, setServerError] = useState<null | string>(null);

  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
  } = useForm<ChangeStatusValues>({
    defaultValues: {
      currentPage: book.readingProgress?.currentPage ?? 0,
      date: todayIso(),
      impression: book.readingProgress?.impression ?? "",
      note: "",
      rating: book.readingProgress?.rating ?? 0,
      resetProgress: false,
      status: defaultStatus ?? book.readingStatus,
    },
    mode: "onTouched",
    resolver: zodResolver(
      buildSchema({
        dateFuture: t("errors.dateFuture"),
        dateInvalid: t("errors.dateInvalid"),
        impressionMax: t("errors.impressionMax", { max: IMPRESSION_MAX }),
        noteMax: t("errors.noteMax", { max: NOTE_MAX }),
        pageOverTotal: t("errors.pageOverTotal", { total: book.pagesCount ?? "—" }),
      }),
    ),
  });

  const status = useWatch({ control, name: "status" });
  const hasSavedPage = (book.readingProgress?.currentPage ?? 0) > 0;
  const fields = fieldsFor(status, hasSavedPage);

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    change.mutate(
      { id: book.id, payload: buildPayload({ fields, values }) },
      {
        onError: (error) =>
          setServerError(error instanceof ApiError ? error.message : t("errors.generic")),
        onSuccess: onDone,
      },
    );
  });

  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>{t("statusDialog.title")}</DialogTitle>
        <DialogDescription>{t("statusDialog.description")}</DialogDescription>
      </DialogHeader>

      <Controller
        control={control}
        name="status"
        render={({ field }) => (
          <StatusChipGroup
            label={t("statusDialog.statusLabel")}
            onValueChange={(next) => field.onChange(next as ReadingStatus)}
            options={readingStatuses.map((entry) => ({
              icon: <UiIcon name={entry.icon} size={16} />,
              label: tOptions(entry.value),
              value: entry.value,
            }))}
            value={field.value}
          />
        )}
      />

      {fields.currentPage ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="status-current-page">
            {status === "dnf" ? t("statusDialog.stopPage") : tFields("currentPage")}
          </Label>
          <Controller
            control={control}
            name="currentPage"
            render={({ field }) => (
              <NumberStepper
                ariaLabel={status === "dnf" ? t("statusDialog.stopPage") : tFields("currentPage")}
                decrementLabel={tCommon("decrement")}
                describedBy={errors.currentPage ? "status-current-page-error" : undefined}
                incrementLabel={tCommon("increment")}
                max={book.pagesCount ?? READING_CURRENT_PAGE_CEILING}
                min={0}
                onValueChange={field.onChange}
                size="sm"
                suffix={book.pagesCount === null ? undefined : `/ ${book.pagesCount}`}
                value={field.value}
              />
            )}
          />
          <FieldError error={errors.currentPage} id="status-current-page-error" />
        </div>
      ) : null}

      {fields.rating ? (
        <div className="flex flex-col gap-2">
          <Label>{tFields("rating")}</Label>
          <Controller
            control={control}
            name="rating"
            render={({ field }) => (
              <Rating
                label={tFields("rating")}
                max={RATING_MAX}
                onValueChange={(next) => field.onChange(Math.max(0, Math.min(RATING_MAX, next)))}
                size="lg"
                value={field.value}
                valueText={(value, max) => tCommon("ratingValueText", { max, value })}
              />
            )}
          />
        </div>
      ) : null}

      {fields.impression ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="status-impression">{tFields("impression")}</Label>
          <Controller
            control={control}
            name="impression"
            render={({ field }) => (
              <>
                <Textarea
                  aria-describedby={
                    errors.impression
                      ? "status-impression-error status-impression-counter"
                      : "status-impression-counter"
                  }
                  aria-invalid={errors.impression !== undefined}
                  id="status-impression"
                  maxLength={IMPRESSION_MAX}
                  onChange={field.onChange}
                  placeholder={tFields("impressionPlaceholder")}
                  value={field.value}
                />
                <div className="flex items-center justify-between gap-2">
                  <FieldError error={errors.impression} id="status-impression-error" />
                  <span
                    className="ml-auto text-xs text-muted-foreground tabular-nums"
                    id="status-impression-counter"
                  >
                    {field.value.length}/{IMPRESSION_MAX}
                  </span>
                </div>
              </>
            )}
          />
        </div>
      ) : null}

      {fields.date ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="status-date">{t("statusDialog.date")}</Label>
          <Controller
            control={control}
            name="date"
            render={({ field }) => (
              <BookDateField
                ariaLabel={t("statusDialog.date")}
                describedBy={errors.date ? "status-date-error" : undefined}
                id="status-date"
                invalid={errors.date !== undefined}
                onChange={(next) => field.onChange(next ?? "")}
                value={field.value}
              />
            )}
          />
          <FieldError error={errors.date} id="status-date-error" />
        </div>
      ) : null}

      {fields.note || fields.reason ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="status-note">
            {fields.reason ? t("statusDialog.reason") : tFields("note")}
          </Label>
          <Controller
            control={control}
            name="note"
            render={({ field }) => (
              <>
                <Textarea
                  aria-describedby={
                    errors.note ? "status-note-error status-note-counter" : "status-note-counter"
                  }
                  aria-invalid={errors.note !== undefined}
                  id="status-note"
                  maxLength={NOTE_MAX}
                  onChange={field.onChange}
                  placeholder={
                    fields.reason ? t("statusDialog.reasonPlaceholder") : tFields("notePlaceholder")
                  }
                  value={field.value}
                />
                <div className="flex items-center justify-between gap-2">
                  <FieldError error={errors.note} id="status-note-error" />
                  <span
                    className="ml-auto text-xs text-muted-foreground tabular-nums"
                    id="status-note-counter"
                  >
                    {field.value.length}/{NOTE_MAX}
                  </span>
                </div>
              </>
            )}
          />
        </div>
      ) : null}

      {fields.resetProgress ? (
        <div className="flex flex-col gap-2.5 rounded-md border border-warning/40 bg-warning/10 p-3.5">
          <p className="text-sm text-foreground">{t("statusDialog.notStartedWarning")}</p>
          <Controller
            control={control}
            name="resetProgress"
            render={({ field }) => (
              <label className="flex cursor-pointer items-center gap-2.5" htmlFor="status-reset">
                <Checkbox
                  checked={field.value}
                  id="status-reset"
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
                <span className="text-sm text-foreground">{t("statusDialog.resetProgress")}</span>
              </label>
            )}
          />
        </div>
      ) : null}

      {serverError === null ? null : (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {serverError}
        </p>
      )}

      <DialogFooter>
        <Button onClick={onDone} type="button" variant="secondary">
          {tActions("cancel")}
        </Button>
        <Button disabled={!isDirty || change.isPending} loading={change.isPending} type="submit">
          {t("statusDialog.submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function fieldsFor(status: ReadingStatus, canResetProgress: boolean): StatusFields {
  const none: StatusFields = {
    currentPage: false,
    date: false,
    impression: false,
    note: false,
    rating: false,
    reason: false,
    resetProgress: false,
  };
  switch (status) {
    case "dnf":
      return { ...none, currentPage: true, date: true, reason: true };
    case "finished":
      return { ...none, date: true, impression: true, rating: true };
    case "not_started":
      return { ...none, resetProgress: canResetProgress };
    case "paused":
      return { ...none, currentPage: true, date: true, note: true };
    case "reading":
    case "rereading":
      return { ...none, currentPage: true, date: true };
    case "want_to_read":
      return none;
  }
}
