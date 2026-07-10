"use client";

import type { BookView, ChangeReadingStatusInput, UpdateReadingProgressInput } from "@app/shared";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

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
import { ApiError } from "@/lib/http-client";

import { useChangeReadingStatus, useUpdateReadingProgress } from "../api/use-reading-progress";
import {
  ISO_DATE_PATTERN,
  READING_CURRENT_PAGE_CEILING,
  todayIso,
} from "../model/reading-progress";
import { BookDateField } from "./book-date-field";

const IMPRESSION_MAX = 5000;
const RATING_MAX = 10;

type UpdateProgressValues = {
  currentPage: number;
  impression: string;
  markAsFinished: boolean;
  rating: number;
  updateDate: string;
};

type UpdateReadingProgressDialogProps = {
  book: BookView;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type ValidationMessages = {
  dateFuture: string;
  dateInvalid: string;
  impressionMax: string;
  pageBelowSaved: string;
  pageOverTotal: string;
};

export function UpdateReadingProgressDialog({
  book,
  onOpenChange,
  open,
}: UpdateReadingProgressDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        {open ? <UpdateProgressForm book={book} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function buildSchema({
  messages,
  pagesCount,
  savedPage,
}: {
  messages: ValidationMessages;
  pagesCount: null | number;
  savedPage: number;
}) {
  return z.object({
    currentPage: z
      .number()
      .int()
      .min(savedPage, messages.pageBelowSaved)
      .max(pagesCount ?? READING_CURRENT_PAGE_CEILING, messages.pageOverTotal),
    impression: z.string().max(IMPRESSION_MAX, messages.impressionMax),
    markAsFinished: z.boolean(),
    rating: z.literal(0).or(z.number().min(0.5).max(RATING_MAX).multipleOf(0.5)),
    updateDate: z
      .string()
      .refine((value) => ISO_DATE_PATTERN.test(value), messages.dateInvalid)
      .refine((value) => value <= todayIso(), messages.dateFuture),
  });
}

function UpdateProgressForm({ book, onDone }: { book: BookView; onDone: () => void }) {
  const t = useTranslations("books.details.reading");
  const tFields = useTranslations("books.readingStatus.fields");
  const tActions = useTranslations("books.actions");
  const tCommon = useTranslations("common");
  const update = useUpdateReadingProgress();
  const change = useChangeReadingStatus();
  const [serverError, setServerError] = useState<null | string>(null);

  const pagesCount = book.pagesCount;
  const savedPage = book.readingProgress?.currentPage ?? 0;

  const {
    control,
    formState: { errors },
    handleSubmit,
    setValue,
  } = useForm<UpdateProgressValues>({
    defaultValues: {
      currentPage: savedPage,
      impression: book.readingProgress?.impression ?? "",
      markAsFinished: false,
      rating: book.readingProgress?.rating ?? 0,
      updateDate: todayIso(),
    },
    mode: "onTouched",
    resolver: zodResolver(
      buildSchema({
        messages: {
          dateFuture: t("errors.dateFuture"),
          dateInvalid: t("errors.dateInvalid"),
          impressionMax: t("errors.impressionMax", { max: IMPRESSION_MAX }),
          pageBelowSaved: t("errors.pageBelowSaved", { saved: savedPage }),
          pageOverTotal: t("errors.pageOverTotal", {
            total: pagesCount ?? READING_CURRENT_PAGE_CEILING,
          }),
        },
        pagesCount,
        savedPage,
      }),
    ),
  });

  const finished = useWatch({ control, name: "markAsFinished" });
  const currentPage = useWatch({ control, name: "currentPage" });
  const delta = currentPage - savedPage;

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    const handlers = {
      onError: (error: Error) =>
        setServerError(error instanceof ApiError ? error.message : t("errors.generic")),
      onSuccess: onDone,
    };

    if (values.markAsFinished) {
      const payload: ChangeReadingStatusInput = {
        date: values.updateDate,
        status: "finished",
      };
      if (values.rating > 0) payload.rating = values.rating;
      if (values.impression.trim().length > 0) payload.impression = values.impression.trim();
      change.mutate({ id: book.id, payload }, handlers);
      return;
    }

    const payload: UpdateReadingProgressInput = {
      currentPage: values.currentPage,
      updateDate: values.updateDate,
    };
    if (pagesCount !== null) payload.markAsFinished = values.markAsFinished;
    update.mutate({ id: book.id, payload }, handlers);
  });

  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>{t("updateDialog.title")}</DialogTitle>
        <DialogDescription>{t("updateDialog.description")}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <Label htmlFor="update-current-page">{tFields("currentPage")}</Label>
        <Controller
          control={control}
          name="currentPage"
          render={({ field }) => (
            <NumberStepper
              ariaLabel={tFields("currentPage")}
              decrementLabel={tCommon("decrement")}
              describedBy={errors.currentPage ? "update-current-page-error" : undefined}
              disabled={finished}
              incrementLabel={tCommon("increment")}
              max={pagesCount ?? READING_CURRENT_PAGE_CEILING}
              min={0}
              onValueChange={(next) => {
                field.onChange(next);
                if (pagesCount !== null) setValue("markAsFinished", next === pagesCount);
              }}
              size="sm"
              suffix={pagesCount === null ? undefined : `/ ${pagesCount}`}
              value={field.value}
            />
          )}
        />
        <FieldError error={errors.currentPage} id="update-current-page-error" />
        {delta > 0 ? (
          <p className="text-xs text-primary tabular-nums">
            {t("updateDialog.pagesSince", { count: delta })}
          </p>
        ) : null}
      </div>

      {pagesCount === null ? null : (
        <Controller
          control={control}
          name="markAsFinished"
          render={({ field }) => (
            <label className="flex cursor-pointer items-center gap-2.5" htmlFor="update-finished">
              <Checkbox
                checked={field.value}
                id="update-finished"
                onCheckedChange={(checked) => {
                  const next = checked === true;
                  field.onChange(next);
                  if (next) setValue("currentPage", pagesCount, { shouldValidate: true });
                }}
              />
              <span className="text-sm text-foreground">{t("updateDialog.markAsFinished")}</span>
            </label>
          )}
        />
      )}

      {finished ? (
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

      {finished ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="update-impression">{tFields("impression")}</Label>
          <Controller
            control={control}
            name="impression"
            render={({ field }) => (
              <>
                <Textarea
                  aria-describedby={
                    errors.impression
                      ? "update-impression-error update-impression-counter"
                      : "update-impression-counter"
                  }
                  aria-invalid={errors.impression !== undefined}
                  id="update-impression"
                  maxLength={IMPRESSION_MAX}
                  onChange={field.onChange}
                  placeholder={tFields("impressionPlaceholder")}
                  value={field.value}
                />
                <div className="flex items-center justify-between gap-2">
                  <FieldError error={errors.impression} id="update-impression-error" />
                  <span
                    className="ml-auto text-xs text-muted-foreground tabular-nums"
                    id="update-impression-counter"
                  >
                    {field.value.length}/{IMPRESSION_MAX}
                  </span>
                </div>
              </>
            )}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="update-date">{t("updateDialog.updateDate")}</Label>
        <Controller
          control={control}
          name="updateDate"
          render={({ field }) => (
            <BookDateField
              ariaLabel={t("updateDialog.updateDate")}
              describedBy={errors.updateDate ? "update-date-error" : undefined}
              id="update-date"
              invalid={errors.updateDate !== undefined}
              onChange={(next) => field.onChange(next ?? "")}
              value={field.value}
            />
          )}
        />
        <FieldError error={errors.updateDate} id="update-date-error" />
      </div>

      {serverError === null ? null : (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {serverError}
        </p>
      )}

      <DialogFooter>
        <Button onClick={onDone} type="button" variant="secondary">
          {tActions("cancel")}
        </Button>
        <Button
          disabled={update.isPending || change.isPending}
          loading={update.isPending || change.isPending}
          type="submit"
        >
          {t("updateDialog.submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
