"use client";

import { useTranslations } from "next-intl";
import { type Control, Controller, type FieldErrors } from "react-hook-form";

import { chipVariants } from "@/components/ui/chip-group";
import { TagInput } from "@/components/ui/tag-input";
import { cn } from "@/lib/utils";

import type { CreateBookFormValues } from "../model/create-book-form";

import { useTagsSearch } from "../api/use-tags-search";

const BOOK_TAGS_MAX = 12;
const SUGGESTION_LIMIT = 8;

type TagsFieldProps = {
  control: Control<CreateBookFormValues>;
  errors: FieldErrors<CreateBookFormValues>;
};

export function TagsField({ control, errors }: TagsFieldProps) {
  const t = useTranslations("books");
  const { data: existingTags = [] } = useTagsSearch("");

  const tagsErrorMessage =
    typeof errors.tags?.message === "string" ? errors.tags.message : undefined;

  return (
    <Controller
      control={control}
      name="tags"
      render={({ field }) => {
        const value = field.value ?? [];
        const atMax = value.length >= BOOK_TAGS_MAX;
        const normalizedSelected = new Set(value.map((tag) => tag.toLowerCase()));
        const suggestions = existingTags
          .filter((tag) => !normalizedSelected.has(tag.name.toLowerCase()))
          .slice(0, SUGGESTION_LIMIT);

        function setTags(next: string[]) {
          field.onChange(next.slice(0, BOOK_TAGS_MAX));
        }

        function addSuggestion(name: string) {
          if (atMax) return;
          if (normalizedSelected.has(name.toLowerCase())) return;
          setTags([...value, name]);
        }

        return (
          <>
            <TagInput
              aria-describedby={tagsErrorMessage ? "book-tags-error" : undefined}
              aria-invalid={tagsErrorMessage !== undefined}
              disabled={atMax}
              id="book-tags"
              onValueChange={setTags}
              placeholder={
                atMax ? t("classification.tagsAtMax") : t("classification.tagsPlaceholder")
              }
              value={value}
            />
            <p className="text-xs text-muted-foreground">
              {t("classification.tagsHint", { max: BOOK_TAGS_MAX })}
            </p>
            {suggestions.length > 0 && !atMax ? (
              <div
                aria-label={t("classification.tagsSuggestions")}
                className="flex flex-wrap gap-2"
                role="group"
              >
                {suggestions.map((tag) => (
                  <button
                    className={cn(chipVariants({ size: "sm" }), "cursor-pointer")}
                    key={tag.id}
                    onClick={() => addSuggestion(tag.name)}
                    type="button"
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            ) : null}
            {tagsErrorMessage ? (
              <p className="text-xs text-destructive" id="book-tags-error" role="alert">
                {tagsErrorMessage}
              </p>
            ) : null}
          </>
        );
      }}
    />
  );
}
