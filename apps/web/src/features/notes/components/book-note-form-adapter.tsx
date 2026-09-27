"use client";

import type { NoteBookPreview } from "@app/shared";

import { NOTE_INPUT_LIMITS } from "@app/shared";
import { useTranslations } from "next-intl";
import { Controller } from "react-hook-form";

import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookSingleSelectPicker } from "@/features/books/components/book-single-select-picker";
import { BookSingleSelectValue } from "@/features/books/components/book-single-select-value";
import {
  blockNegativeNumberKeys,
  blockNegativeNumberPaste,
} from "@/lib/block-negative-number-keys";

import type { NoteFormControl, NoteFormErrors, NoteFormRegister } from "../model/note-form-schema";

import { bookSelectOptionFromPreview, noteEntityRefFromBook } from "../model/note-entity-options";
import { NOTE_FORM_FIELD_IDS } from "./note-form-field-ids";

export function BookNoteLinkedEntity({ book }: { book: NoteBookPreview }) {
  return <BookSingleSelectValue book={bookSelectOptionFromPreview(book)} />;
}

export function BookNoteLocationFields({
  control,
  errors,
  register,
}: {
  control: NoteFormControl;
  errors: NoteFormErrors;
  register: NoteFormRegister;
}) {
  const t = useTranslations("notes.form");

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Label className="flex-wrap" htmlFor={NOTE_FORM_FIELD_IDS.chapter}>
          {t("chapter")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
        </Label>
        <Input
          aria-describedby={errors.chapter ? NOTE_FORM_FIELD_IDS.chapterError : undefined}
          aria-invalid={errors.chapter !== undefined}
          autoComplete="off"
          className="h-10"
          id={NOTE_FORM_FIELD_IDS.chapter}
          maxLength={NOTE_INPUT_LIMITS.chapterMax}
          placeholder={t("chapterPlaceholder")}
          {...register("chapter")}
        />
        <FieldError error={errors.chapter} id={NOTE_FORM_FIELD_IDS.chapterError} />
      </div>

      <div className="flex min-w-0 flex-col gap-2 sm:w-44">
        <Label className="flex-wrap" htmlFor={NOTE_FORM_FIELD_IDS.page}>
          {t("page")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
        </Label>
        <Controller
          control={control}
          name="page"
          render={({ field }) => (
            <Input
              aria-describedby={errors.page ? NOTE_FORM_FIELD_IDS.pageError : undefined}
              aria-invalid={errors.page !== undefined}
              autoComplete="off"
              className="h-10"
              id={NOTE_FORM_FIELD_IDS.page}
              inputMode="numeric"
              min={1}
              onBlur={field.onBlur}
              onChange={(event) =>
                field.onChange(event.target.value === "" ? undefined : Number(event.target.value))
              }
              onKeyDown={blockNegativeNumberKeys}
              onPaste={blockNegativeNumberPaste}
              placeholder={t("pagePlaceholder")}
              ref={field.ref}
              step={1}
              type="number"
              value={field.value ?? ""}
            />
          )}
        />
        <FieldError error={errors.page} id={NOTE_FORM_FIELD_IDS.pageError} />
      </div>
    </div>
  );
}

export function BookNotePickerField({
  control,
  error,
}: {
  control: NoteFormControl;
  error: NoteFormErrors["entity"];
}) {
  const t = useTranslations("notes.form.bookPicker");

  return (
    <Controller
      control={control}
      name="entity"
      render={({ field }) => (
        <BookSingleSelectPicker
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
          onChange={(book) => field.onChange(noteEntityRefFromBook(book))}
          ref={field.ref}
          required
          value={
            field.value?.type === "book" ? bookSelectOptionFromPreview(field.value.book) : null
          }
        />
      )}
    />
  );
}
