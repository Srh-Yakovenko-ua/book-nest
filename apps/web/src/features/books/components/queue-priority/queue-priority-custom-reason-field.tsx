"use client";

import { QUEUE_PRIORITY_REASON_CUSTOM_TEXT_MAX } from "@app/shared";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { type Control, Controller, type FieldErrors } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { CreateBookFormValues } from "../../model/create-book-form";

import { QUEUE_PRIORITY_CUSTOM_REASON_REQUIRED_MESSAGE } from "../../model/queue-priority";

type QueuePriorityCustomReasonFieldProps = {
  control: Control<CreateBookFormValues>;
  errors: FieldErrors<CreateBookFormValues>;
};

export function QueuePriorityCustomReasonField({
  control,
  errors,
}: QueuePriorityCustomReasonFieldProps) {
  const t = useTranslations("books.organization.priority");
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const counterId = `${fieldId}-counter`;

  const rawError = errors.queuePriorityReasonCustomText?.message;
  const errorMessage =
    rawError === QUEUE_PRIORITY_CUSTOM_REASON_REQUIRED_MESSAGE
      ? t("customReason.error")
      : typeof rawError === "string"
        ? rawError
        : undefined;

  return (
    <Controller
      control={control}
      name="queuePriorityReasonCustomText"
      render={({ field }) => {
        const value = typeof field.value === "string" ? field.value : "";
        return (
          <div className="flex flex-col gap-2 motion-safe:animate-in motion-safe:duration-150 motion-safe:fade-in-0 motion-safe:slide-in-from-top-1">
            <Label htmlFor={fieldId}>{t("customReason.label")}</Label>
            <Input
              aria-describedby={errorMessage === undefined ? counterId : errorId}
              aria-invalid={errorMessage !== undefined}
              autoComplete="off"
              className="h-10"
              id={fieldId}
              maxLength={QUEUE_PRIORITY_REASON_CUSTOM_TEXT_MAX}
              onBlur={field.onBlur}
              onChange={(event) => field.onChange(event.target.value)}
              placeholder={t("customReason.placeholder")}
              value={value}
            />
            <div className="flex items-center justify-between gap-2">
              {errorMessage === undefined ? null : (
                <p className="text-xs text-destructive" id={errorId} role="alert">
                  {errorMessage}
                </p>
              )}
              <span className="ml-auto text-xs text-muted-foreground tabular-nums" id={counterId}>
                {value.length}/{QUEUE_PRIORITY_REASON_CUSTOM_TEXT_MAX}
              </span>
            </div>
          </div>
        );
      }}
    />
  );
}
