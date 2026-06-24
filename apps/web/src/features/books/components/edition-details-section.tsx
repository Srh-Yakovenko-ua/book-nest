"use client";

import { useTranslations } from "next-intl";
import { type Control, type FieldErrors, type UseFormRegister, useWatch } from "react-hook-form";

import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { CreateBookFormValues } from "../model/create-book-form";

import { FormSection } from "./form-section";

const PAGES_MIN = 1;
const PAGES_MAX = 10000;
const PUBLICATION_YEAR_MAX = new Date().getUTCFullYear() + 1;
const DEDICATION_MAX = 300;

type EditionDetailsSectionProps = {
  control: Control<CreateBookFormValues>;
  errors: FieldErrors<CreateBookFormValues>;
  register: UseFormRegister<CreateBookFormValues>;
};

export function EditionDetailsSection({ control, errors, register }: EditionDetailsSectionProps) {
  const t = useTranslations("books");
  const dedicationValue = useWatch({ control, defaultValue: undefined, name: "dedication" }) ?? "";
  const dedicationLength = typeof dedicationValue === "string" ? dedicationValue.length : 0;

  const pagesCountValue = useWatch({ control, name: "pagesCount" });
  const currentPageValue = useWatch({ control, name: "readingProgress.currentPage" });
  const showCurrentPageWarning =
    typeof pagesCountValue === "number" &&
    typeof currentPageValue === "number" &&
    currentPageValue > pagesCountValue;

  return (
    <FormSection
      description={t("editionDetails.description")}
      icon="book"
      title={t("editionDetails.title")}
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="book-pages-count">
            {t("editionDetails.fields.pagesCount")}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              {t("fields.optional")}
            </span>
          </Label>
          <Input
            aria-describedby={errors.pagesCount ? "book-pages-count-error" : undefined}
            aria-invalid={errors.pagesCount !== undefined}
            className="h-10"
            id="book-pages-count"
            inputMode="numeric"
            max={PAGES_MAX}
            min={PAGES_MIN}
            placeholder={t("editionDetails.fields.pagesCountPlaceholder")}
            step={1}
            type="number"
            {...register("pagesCount", { setValueAs: emptyToInteger })}
          />
          <FieldError error={errors.pagesCount} id="book-pages-count-error" />
          {showCurrentPageWarning ? (
            <p className="text-xs text-warning" role="status">
              {t("editionDetails.currentPageWarning")}
            </p>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="book-publication-year">
            {t("editionDetails.fields.publicationYear")}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              {t("fields.optional")}
            </span>
          </Label>
          <Input
            aria-describedby={errors.publicationYear ? "book-publication-year-error" : undefined}
            aria-invalid={errors.publicationYear !== undefined}
            className="h-10"
            id="book-publication-year"
            inputMode="numeric"
            max={PUBLICATION_YEAR_MAX}
            placeholder={t("editionDetails.fields.publicationYearPlaceholder")}
            step={1}
            type="number"
            {...register("publicationYear", { setValueAs: emptyToInteger })}
          />
          <FieldError error={errors.publicationYear} id="book-publication-year-error" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="book-isbn">
          {t("editionDetails.fields.isbn")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{t("fields.optional")}</span>
        </Label>
        <Input
          aria-describedby={errors.isbn ? "book-isbn-error" : undefined}
          aria-invalid={errors.isbn !== undefined}
          autoComplete="off"
          className="h-10"
          id="book-isbn"
          placeholder={t("editionDetails.fields.isbnPlaceholder")}
          {...register("isbn", { setValueAs: emptyToUndefined })}
        />
        <FieldError error={errors.isbn} id="book-isbn-error" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="book-original-title">
          {t("editionDetails.fields.originalTitle")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{t("fields.optional")}</span>
        </Label>
        <Input
          aria-describedby={errors.originalTitle ? "book-original-title-error" : undefined}
          aria-invalid={errors.originalTitle !== undefined}
          autoComplete="off"
          className="h-10"
          id="book-original-title"
          placeholder={t("editionDetails.fields.originalTitlePlaceholder")}
          {...register("originalTitle", { setValueAs: emptyToUndefined })}
        />
        <FieldError error={errors.originalTitle} id="book-original-title-error" />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="book-translator">
            {t("editionDetails.fields.translator")}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              {t("fields.optional")}
            </span>
          </Label>
          <Input
            aria-describedby={errors.translator ? "book-translator-error" : undefined}
            aria-invalid={errors.translator !== undefined}
            autoComplete="off"
            className="h-10"
            id="book-translator"
            placeholder={t("editionDetails.fields.translatorPlaceholder")}
            {...register("translator", { setValueAs: emptyToUndefined })}
          />
          <FieldError error={errors.translator} id="book-translator-error" />
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="book-illustrator">
            {t("editionDetails.fields.illustrator")}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              {t("fields.optional")}
            </span>
          </Label>
          <Input
            aria-describedby={errors.illustrator ? "book-illustrator-error" : undefined}
            aria-invalid={errors.illustrator !== undefined}
            autoComplete="off"
            className="h-10"
            id="book-illustrator"
            placeholder={t("editionDetails.fields.illustratorPlaceholder")}
            {...register("illustrator", { setValueAs: emptyToUndefined })}
          />
          <FieldError error={errors.illustrator} id="book-illustrator-error" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="book-dedication">
          {t("editionDetails.fields.dedication")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{t("fields.optional")}</span>
        </Label>
        <Textarea
          aria-describedby="book-dedication-counter"
          aria-invalid={errors.dedication !== undefined}
          id="book-dedication"
          maxLength={DEDICATION_MAX}
          placeholder={t("editionDetails.fields.dedicationPlaceholder")}
          {...register("dedication", { setValueAs: emptyToUndefined })}
        />
        <div className="flex items-center justify-between gap-2">
          <FieldError error={errors.dedication} id="book-dedication-error" />
          <span
            className="ml-auto text-xs text-muted-foreground tabular-nums"
            id="book-dedication-counter"
          >
            {dedicationLength}/{DEDICATION_MAX}
          </span>
        </div>
      </div>
    </FormSection>
  );
}

function emptyToInteger(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function emptyToUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
