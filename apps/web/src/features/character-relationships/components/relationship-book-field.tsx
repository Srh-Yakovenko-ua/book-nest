"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { Controller } from "react-hook-form";

import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { RelationshipBookStep } from "../model/relationship-book-step";
import type {
  RelationshipFormControl,
  RelationshipFormErrors,
} from "../model/relationship-form-schema";

const BOOK_FIELD = {
  errorId: "relationship-book-error",
  id: "relationship-book",
  noBook: "__none__",
  unselected: "",
} as const;

type RelationshipBookFieldProps = {
  control: RelationshipFormControl;
  error: RelationshipFormErrors["bookId"];
  noBookLabel: string;
  onBookChange: (bookId: Nullable<string>) => void;
  step: RelationshipBookStep;
};

export function RelationshipBookField({
  control,
  error,
  noBookLabel,
  onBookChange,
  step,
}: RelationshipBookFieldProps) {
  const t = useTranslations("relationships.editor.book");

  if (step.kind === "fixed") {
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-medium text-foreground">{t("label")}</span>
        <p className="truncate text-sm text-foreground">{step.book.title ?? t("current")}</p>
        <FieldError error={error} id={BOOK_FIELD.errorId} />
      </div>
    );
  }

  const emptyValue = step.kind === "optional" ? BOOK_FIELD.noBook : BOOK_FIELD.unselected;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={BOOK_FIELD.id}>{t("label")}</Label>
      <Controller
        control={control}
        name="bookId"
        render={({ field }) => (
          <Select
            onValueChange={(next) => onBookChange(next === BOOK_FIELD.noBook ? null : next)}
            value={field.value ?? emptyValue}
          >
            <SelectTrigger
              aria-describedby={error ? BOOK_FIELD.errorId : undefined}
              aria-invalid={error !== undefined}
              className="w-full data-[size=default]:h-10"
              id={BOOK_FIELD.id}
              onBlur={field.onBlur}
              ref={field.ref}
            >
              <SelectValue placeholder={t("placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {step.kind === "optional" ? (
                <SelectItem value={BOOK_FIELD.noBook}>{noBookLabel}</SelectItem>
              ) : null}
              {step.options.map((book) => (
                <SelectItem key={book.id} value={book.id}>
                  {book.title ?? t("untitled")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      <FieldError error={error} id={BOOK_FIELD.errorId} />
    </div>
  );
}
