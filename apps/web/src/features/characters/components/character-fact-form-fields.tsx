"use client";

import { CHARACTER_FACT_INPUT_LIMITS } from "@app/shared";
import { useTranslations } from "next-intl";
import { Controller, useWatch } from "react-hook-form";

import { SuggestionCombobox } from "@/components/suggestion-combobox";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBookChapters } from "@/features/books/api/use-book-chapters";
import {
  blockNegativeNumberKeys,
  blockNegativeNumberPaste,
} from "@/lib/block-negative-number-keys";

import type {
  CharacterFactFormControl,
  CharacterFactFormErrors,
  CharacterFactFormRegister,
} from "../model/character-fact-form-schema";

const FIELD_IDS = {
  chapter: "character-fact-chapter",
  chapterError: "character-fact-chapter-error",
  page: "character-fact-page",
  pageError: "character-fact-page-error",
  text: "character-fact-text",
  textCounter: "character-fact-text-counter",
  textError: "character-fact-text-error",
  title: "character-fact-title",
  titleError: "character-fact-title-error",
} as const;

type CharacterFactFormFieldsProps = {
  bookId: string;
  control: CharacterFactFormControl;
  errors: CharacterFactFormErrors;
  pageMax: number;
  register: CharacterFactFormRegister;
};

export function CharacterFactFormFields({
  bookId,
  control,
  errors,
  pageMax,
  register,
}: CharacterFactFormFieldsProps) {
  const t = useTranslations("characters.facts.form");
  const text = useWatch({ control, name: "text" });
  const chaptersQuery = useBookChapters(bookId, { enabled: true });

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor={FIELD_IDS.title}>
          {t("title")} <RequiredMark />
        </Label>
        <Input
          aria-describedby={errors.title ? FIELD_IDS.titleError : undefined}
          aria-invalid={errors.title !== undefined}
          aria-required
          autoComplete="off"
          className="h-10"
          id={FIELD_IDS.title}
          maxLength={CHARACTER_FACT_INPUT_LIMITS.titleMax}
          placeholder={t("titlePlaceholder")}
          {...register("title")}
        />
        <FieldError error={errors.title} id={FIELD_IDS.titleError} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={FIELD_IDS.text}>
          {t("text")} <RequiredMark />
        </Label>
        <Textarea
          aria-describedby={
            errors.text ? `${FIELD_IDS.textError} ${FIELD_IDS.textCounter}` : FIELD_IDS.textCounter
          }
          aria-invalid={errors.text !== undefined}
          aria-required
          className="min-h-32"
          id={FIELD_IDS.text}
          maxLength={CHARACTER_FACT_INPUT_LIMITS.textMax}
          placeholder={t("textPlaceholder")}
          {...register("text")}
        />
        <div className="flex items-start justify-between gap-2">
          <FieldError error={errors.text} id={FIELD_IDS.textError} />
          <span
            className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums"
            id={FIELD_IDS.textCounter}
          >
            {t("textRemaining", { count: CHARACTER_FACT_INPUT_LIMITS.textMax - text.length })}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Label className="flex-wrap" htmlFor={FIELD_IDS.chapter}>
            {t("chapter")} <OptionalMark />
          </Label>
          <Controller
            control={control}
            name="chapter"
            render={({ field }) => (
              <SuggestionCombobox
                describedBy={errors.chapter ? FIELD_IDS.chapterError : undefined}
                id={FIELD_IDS.chapter}
                invalid={errors.chapter !== undefined}
                maxLength={CHARACTER_FACT_INPUT_LIMITS.chapterMax}
                onChange={field.onChange}
                options={chaptersQuery.data ?? []}
                placeholder={t("chapterPlaceholder")}
                value={field.value}
              />
            )}
          />
          <FieldError error={errors.chapter} id={FIELD_IDS.chapterError} />
        </div>

        <div className="flex min-w-0 flex-col gap-2 sm:w-44">
          <Label className="flex-wrap" htmlFor={FIELD_IDS.page}>
            {t("page")} <OptionalMark />
          </Label>
          <Controller
            control={control}
            name="page"
            render={({ field }) => (
              <Input
                aria-describedby={errors.page ? FIELD_IDS.pageError : undefined}
                aria-invalid={errors.page !== undefined}
                autoComplete="off"
                className="h-10"
                id={FIELD_IDS.page}
                inputMode="numeric"
                max={pageMax}
                min={1}
                onBlur={field.onBlur}
                onChange={(event) =>
                  field.onChange(event.target.value === "" ? null : Number(event.target.value))
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
          <FieldError error={errors.page} id={FIELD_IDS.pageError} />
        </div>
      </div>
    </>
  );
}

function OptionalMark() {
  const t = useTranslations("characters.facts.form");

  return <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>;
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  );
}
