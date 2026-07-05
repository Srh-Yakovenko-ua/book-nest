"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { type Control, type FieldErrors, type UseFormRegister, useWatch } from "react-hook-form";

import { UiIcon } from "@/components/icons";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  blockNegativeNumberKeys,
  blockNegativeNumberPaste,
} from "@/lib/block-negative-number-keys";

import type { CreateBookFormValues } from "../model/create-book-form";

import { EDITION_DETAILS_FIELDS } from "../model/section-completeness";
import { FormSection } from "./form-section";
import { useSectionCompletion } from "./use-section-completion";

const PAGES_MIN = 1;
const PAGES_MAX = 10000;
const PUBLICATION_YEAR_MAX = new Date().getUTCFullYear() + 1;

type EditionDetailsSectionProps = {
  control: Control<CreateBookFormValues>;
  errors: FieldErrors<CreateBookFormValues>;
  register: UseFormRegister<CreateBookFormValues>;
};

const ISBN_MAX_LENGTH = 13;

export function EditionDetailsSection({ control, errors, register }: EditionDetailsSectionProps) {
  const t = useTranslations("books");
  const isbnField = register("isbn", { setValueAs: emptyToUndefined });

  const initialIsbn = useWatch({ control, name: "isbn" });
  const initialTranslator = useWatch({ control, name: "translator" });
  const initialIllustrator = useWatch({ control, name: "illustrator" });
  const [advancedOpen, setAdvancedOpen] = useState(
    Boolean(initialIsbn) || Boolean(initialTranslator) || Boolean(initialIllustrator),
  );
  const complete = useSectionCompletion(control, EDITION_DETAILS_FIELDS);

  return (
    <FormSection
      complete={complete}
      completeLabel={t("form.sectionComplete")}
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
            onKeyDown={blockNegativeNumberKeys}
            onPaste={blockNegativeNumberPaste}
            placeholder={t("editionDetails.fields.pagesCountPlaceholder")}
            step={1}
            type="number"
            {...register("pagesCount", { setValueAs: emptyToInteger })}
          />
          <FieldError error={errors.pagesCount} id="book-pages-count-error" />
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
            onKeyDown={blockNegativeNumberKeys}
            onPaste={blockNegativeNumberPaste}
            placeholder={t("editionDetails.fields.publicationYearPlaceholder")}
            step={1}
            type="number"
            {...register("publicationYear", { setValueAs: emptyToInteger })}
          />
          <FieldError error={errors.publicationYear} id="book-publication-year-error" />
        </div>
      </div>

      <Collapsible
        className="flex flex-col gap-4"
        onOpenChange={setAdvancedOpen}
        open={advancedOpen}
      >
        <CollapsibleTrigger className="group flex cursor-pointer items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-ink transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
          {t("editionDetails.advancedDetails")}
          <UiIcon
            className="text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
            name="chevron-down"
            size={16}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="book-isbn">
              {t("editionDetails.fields.isbn")}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                {t("fields.optional")}
              </span>
            </Label>
            <Input
              aria-describedby={errors.isbn ? "book-isbn-error" : undefined}
              aria-invalid={errors.isbn !== undefined}
              autoComplete="off"
              className="h-10"
              id="book-isbn"
              inputMode="numeric"
              maxLength={ISBN_MAX_LENGTH}
              placeholder={t("editionDetails.fields.isbnPlaceholder")}
              {...isbnField}
              onChange={(event) => {
                event.target.value = event.target.value.replace(/\D/g, "");
                return isbnField.onChange(event);
              }}
            />
            <FieldError error={errors.isbn} id="book-isbn-error" />
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
        </CollapsibleContent>
      </Collapsible>
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
