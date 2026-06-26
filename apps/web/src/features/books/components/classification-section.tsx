"use client";

import { useTranslations } from "next-intl";
import { type Control, Controller, type FieldErrors } from "react-hook-form";

import { Label } from "@/components/ui/label";
import { Multiselect, type MultiselectOption } from "@/components/ui/multiselect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { CreateBookFormValues } from "../model/create-book-form";

import { useGenres } from "../api/use-genres";
import {
  AGE_CATEGORY_OPTIONS,
  BOOK_GENRES_MAX,
  BOOK_LANGUAGE_OPTIONS,
} from "../model/book-classification-fields";
import { FormSection } from "./form-section";
import { TagsField } from "./tags-field";

type ClassificationSectionProps = {
  control: Control<CreateBookFormValues>;
  errors: FieldErrors<CreateBookFormValues>;
};

export function ClassificationSection({ control, errors }: ClassificationSectionProps) {
  const t = useTranslations("books");
  const genres = useGenres();
  const genresErrorMessage =
    typeof errors.genres?.message === "string" ? errors.genres.message : undefined;

  const genreList = genres.data ?? [];
  const genreNameByKey = new Map(genreList.map((genre) => [genre.key, genre.name]));

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
            const selected = field.value ?? [];
            const atMax = selected.length >= BOOK_GENRES_MAX;
            const options: MultiselectOption[] = genreList
              .filter((genre) => !atMax || selected.includes(genre.key))
              .map((genre) => ({
                group: genre.groupName,
                label: genre.name,
                value: genre.key,
              }));
            for (const key of selected) {
              if (options.some((option) => option.value === key)) continue;
              options.push({ label: genreNameByKey.get(key) ?? key, value: key });
            }
            return (
              <Multiselect
                disabled={genres.isPending}
                emptyText={
                  genres.isPending
                    ? t("classification.genresLoading")
                    : t("classification.genresEmpty")
                }
                id="book-genres"
                onValueChange={(next) => {
                  field.onChange(next.slice(0, BOOK_GENRES_MAX));
                }}
                options={options}
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
