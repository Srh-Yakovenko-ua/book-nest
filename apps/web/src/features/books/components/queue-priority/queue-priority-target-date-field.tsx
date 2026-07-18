"use client";

import type { QueuePriorityReason } from "@app/shared";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { type Control, Controller, type FieldErrors } from "react-hook-form";

import { Label } from "@/components/ui/label";

import type { CreateBookFormValues } from "../../model/create-book-form";

import { BookDateField } from "../book-date-field";

type QueuePriorityTargetDateFieldProps = {
  control: Control<CreateBookFormValues>;
  errors: FieldErrors<CreateBookFormValues>;
  reason: QueuePriorityReason;
};

export function QueuePriorityTargetDateField({
  control,
  errors,
  reason,
}: QueuePriorityTargetDateFieldProps) {
  const t = useTranslations("books.organization.priority");
  const tFields = useTranslations("books");
  const fieldId = useId();
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;

  const error = errors.queuePriorityTargetDate;
  const errorMessage = typeof error?.message === "string" ? error.message : undefined;
  const hint = reason === "return_due" ? t("targetDate.returnDueHint") : t("targetDate.hint");

  return (
    <div className="flex flex-col gap-2 motion-safe:animate-in motion-safe:duration-150 motion-safe:fade-in-0 motion-safe:slide-in-from-top-1">
      <Label htmlFor={fieldId}>
        {t("targetDate.label")}{" "}
        <span className="text-xs font-normal text-muted-foreground">
          {tFields("fields.optional")}
        </span>
      </Label>
      <Controller
        control={control}
        name="queuePriorityTargetDate"
        render={({ field }) => (
          <BookDateField
            allowFuture
            ariaLabel={t("targetDate.label")}
            className="h-10"
            describedBy={errorMessage === undefined ? hintId : errorId}
            disablePast
            id={fieldId}
            invalid={errorMessage !== undefined}
            onChange={field.onChange}
            placeholder={t("targetDate.placeholder")}
            value={field.value}
          />
        )}
      />
      <p className="text-xs text-muted-foreground" id={hintId}>
        {hint}
      </p>
      {errorMessage === undefined ? null : (
        <p className="text-xs text-destructive" id={errorId} role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
