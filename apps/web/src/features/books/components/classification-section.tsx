"use client";

import { useTranslations } from "next-intl";
import { type Control, Controller, type FieldErrors } from "react-hook-form";

import { UiIcon } from "@/components/icons";
import { Label } from "@/components/ui/label";
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
import { CLASSIFICATION_FIELDS } from "../model/section-completeness";
import { FormSection } from "./form-section";
import { GenresField } from "./genres-field";
import { TagsField } from "./tags-field";
import { useSectionCompletion } from "./use-section-completion";

type ClassificationSectionProps = {
  control: Control<CreateBookFormValues>;
  errors: FieldErrors<CreateBookFormValues>;
  genresHintSeriesName?: null | string;
  genresSuggestion?: GenresSuggestion | null;
  onGenresUserEdit?: () => void;
};

type GenresSuggestion = {
  genres: string[];
  onApply: () => void;
  onDismiss: () => void;
};

export function ClassificationSection({
  control,
  errors,
  genresHintSeriesName,
  genresSuggestion,
  onGenresUserEdit,
}: ClassificationSectionProps) {
  const t = useTranslations("books");
  const genres = useGenres();
  const genresErrorMessage =
    typeof errors.genres?.message === "string" ? errors.genres.message : undefined;

  const genreNameByKey = new Map((genres.data ?? []).map((genre) => [genre.key, genre.name]));
  const complete = useSectionCompletion(control, CLASSIFICATION_FIELDS);
  const suggestionGenreNames = genresSuggestion?.genres
    .map((key) => genreNameByKey.get(key) ?? key)
    .join(", ");

  return (
    <FormSection
      complete={complete}
      completeLabel={t("form.sectionComplete")}
      description={t("classification.description")}
      icon="tag"
      title={t("classification.title")}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="book-genres">{t("classification.genres")}</Label>
        <Controller
          control={control}
          name="genres"
          render={({ field }) => (
            <GenresField
              id="book-genres"
              onChange={(next) => {
                field.onChange(next);
                onGenresUserEdit?.();
              }}
              value={field.value ?? []}
            />
          )}
        />
        <p className="text-xs text-muted-foreground">
          {t("classification.genresHint", { max: BOOK_GENRES_MAX })}
        </p>
        {genresHintSeriesName ? (
          <p className="text-xs text-muted-foreground">
            {t("classification.genresFromSeries", { name: genresHintSeriesName })}
          </p>
        ) : null}
        {genresSuggestion ? (
          <div className="flex items-center gap-1.5">
            <button
              className="cursor-pointer text-left text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
              onClick={genresSuggestion.onApply}
              type="button"
            >
              {t("classification.genresSeriesSuggestion", { genres: suggestionGenreNames ?? "" })}
            </button>
            <button
              aria-label={t("classification.genresSeriesSuggestionDismiss")}
              className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              onClick={genresSuggestion.onDismiss}
              type="button"
            >
              <UiIcon name="x" size={14} />
            </button>
          </div>
        ) : null}
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
            render={({ field }) => {
              const value = field.value ?? "not_specified";
              return (
                <Select onValueChange={field.onChange} value={value}>
                  <SelectTrigger
                    className="h-10 w-full"
                    id="book-age-category"
                    isClearable={value !== "not_specified"}
                    onClear={() => field.onChange("not_specified")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGE_CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t(`classification.ageCategoryLabels.${option}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            }}
          />
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="book-language">{t("classification.language")}</Label>
          <Controller
            control={control}
            name="language"
            render={({ field }) => {
              const value = field.value ?? "ukrainian";
              return (
                <Select onValueChange={field.onChange} value={value}>
                  <SelectTrigger
                    className="h-10 w-full"
                    id="book-language"
                    isClearable={value !== "ukrainian"}
                    onClear={() => field.onChange("ukrainian")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BOOK_LANGUAGE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t(`classification.languageLabels.${option}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            }}
          />
        </div>
      </div>
    </FormSection>
  );
}
