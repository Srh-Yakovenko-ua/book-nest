"use client";

import { useTranslations } from "next-intl";
import { type Control, Controller, type FieldErrors } from "react-hook-form";

import { Label } from "@/components/ui/label";
import { Multiselect } from "@/components/ui/multiselect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { CreateBookFormValues } from "../model/create-book-form";

import {
  AGE_CATEGORY_OPTIONS,
  BOOK_GENRE_OPTIONS,
  BOOK_GENRES_MAX,
  BOOK_LANGUAGE_OPTIONS,
  isBookGenre,
} from "../model/book-classification-fields";
import { FormSection } from "./form-section";
import { TagsField } from "./tags-field";

type ClassificationSectionProps = {
  control: Control<CreateBookFormValues>;
  errors: FieldErrors<CreateBookFormValues>;
};

export function ClassificationSection({ control, errors }: ClassificationSectionProps) {
  const t = useTranslations("books");
  const genresErrorMessage =
    typeof errors.genres?.message === "string" ? errors.genres.message : undefined;

  return (
    <FormSection
      description={t("classification.description")}
      icon="tag"
      title={t("classification.title")}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="book-genres">{t("classification.genres")}</Label>
        <Controller
          control={control}
          name="genres"
          render={({ field }) => {
            const selected = (field.value ?? []).filter(isBookGenre);
            const atMax = selected.length >= BOOK_GENRES_MAX;
            return (
              <Multiselect
                emptyText={t("classification.genresEmpty")}
                id="book-genres"
                onValueChange={(next) => {
                  const genres = next.filter(isBookGenre);
                  field.onChange(genres.slice(0, BOOK_GENRES_MAX));
                }}
                options={BOOK_GENRE_OPTIONS.filter(
                  (value) => !atMax || selected.includes(value),
                ).map((value) => ({
                  label: t(`classification.genreLabels.${value}`),
                  value,
                }))}
                placeholder={t("classification.genresPlaceholder")}
                searchPlaceholder={t("classification.genresSearch")}
                value={selected}
              />
            );
          }}
        />
        <p className="text-xs text-muted-foreground">
          {t("classification.genresHint", { max: BOOK_GENRES_MAX })}
        </p>
        {genresErrorMessage ? (
          <p className="text-xs text-destructive" id="book-genres-error" role="alert">
            {genresErrorMessage}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="book-tags">{t("classification.tags")}</Label>
        <TagsField control={control} errors={errors} />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="book-age-category">{t("classification.ageCategory")}</Label>
          <Controller
            control={control}
            name="ageCategory"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value ?? "not_specified"}>
                <SelectTrigger className="h-10 w-full" id="book-age-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGE_CATEGORY_OPTIONS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`classification.ageCategoryLabels.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="book-language">{t("classification.language")}</Label>
          <Controller
            control={control}
            name="language"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value ?? "ukrainian"}>
                <SelectTrigger className="h-10 w-full" id="book-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOOK_LANGUAGE_OPTIONS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`classification.languageLabels.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>
    </FormSection>
  );
}
