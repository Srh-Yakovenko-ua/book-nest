"use client";

import type { TagView } from "@app/shared";

import { TAG_NAME_ALLOWED_CHARS, TAG_NAME_MAX, TAG_NAME_MIN } from "@app/shared";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { type Control, Controller, type FieldErrors } from "react-hook-form";

import { UiIcon } from "@/components/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { chipVariants } from "@/components/ui/chip-group";
import { TagInput } from "@/components/ui/tag-input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

import type { CreateBookFormValues } from "../model/create-book-form";

import { useDeleteTag } from "../api/use-delete-tag";
import { useTagsSearch } from "../api/use-tags-search";

const BOOK_TAGS_MAX = 12;
const SUGGESTION_LIMIT = 8;
const SEARCH_DEBOUNCE_MS = 250;

type TagsFieldProps = {
  control: Control<CreateBookFormValues>;
  errors: FieldErrors<CreateBookFormValues>;
};

export function TagsField({ control, errors }: TagsFieldProps) {
  const t = useTranslations("books");
  const [draft, setDraft] = useState("");
  const [tagPendingDelete, setTagPendingDelete] = useState<null | TagView>(null);
  const debouncedDraft = useDebouncedValue(draft, SEARCH_DEBOUNCE_MS);
  const { data: existingTags = [], isFetching } = useTagsSearch(debouncedDraft);
  const deleteTag = useDeleteTag();

  function confirmDeleteTag() {
    if (tagPendingDelete === null) return;
    deleteTag.mutate(tagPendingDelete.id);
    setTagPendingDelete(null);
  }

  const tagsErrorMessage =
    typeof errors.tags?.message === "string" ? errors.tags.message : undefined;

  function validateTag(label: string): string | undefined {
    if (label.length < TAG_NAME_MIN) return t("classification.tagsTooShort");
    if (label.length > TAG_NAME_MAX) return t("classification.tagsTooLong");
    if (!TAG_NAME_ALLOWED_CHARS.test(label)) return t("classification.tagsInvalidChars");
    return undefined;
  }

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
        const hasNoSavedTags = !isFetching && existingTags.length === 0 && draft.trim() === "";

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
              onInputChange={setDraft}
              onValueChange={setTags}
              placeholder={
                atMax ? t("classification.tagsAtMax") : t("classification.tagsPlaceholder")
              }
              validateTag={validateTag}
              value={value}
            />
            <p className="text-xs text-muted-foreground">
              {t("classification.tagsHint", { max: BOOK_TAGS_MAX })}
            </p>
            {hasNoSavedTags && !atMax ? (
              <p className="text-xs text-muted-foreground">{t("classification.tagsNoSaved")}</p>
            ) : null}
            {suggestions.length > 0 && !atMax ? (
              <div
                aria-label={t("classification.tagsSuggestions")}
                className="flex flex-wrap gap-2"
                role="group"
              >
                {suggestions.map((tag) => (
                  <span className={cn(chipVariants({ size: "sm" }), "pr-1")} key={tag.id}>
                    <button
                      className="cursor-pointer rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      onClick={() => addSuggestion(tag.name)}
                      type="button"
                    >
                      {tag.name}
                    </button>
                    <button
                      aria-label={t("classification.tagsDeleteSaved", { name: tag.name })}
                      className="relative grid size-[18px] shrink-0 cursor-pointer place-items-center rounded-full text-tag-foreground opacity-65 transition-[opacity,background-color] after:absolute after:-inset-[3px] hover:bg-destructive/15 hover:text-destructive hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                      onClick={() => setTagPendingDelete(tag)}
                      type="button"
                    >
                      <UiIcon className="size-3" name="x" size={12} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            {tagsErrorMessage ? (
              <p className="text-xs text-destructive" id="book-tags-error" role="alert">
                {tagsErrorMessage}
              </p>
            ) : null}
            <AlertDialog
              onOpenChange={(open) => {
                if (!open) setTagPendingDelete(null);
              }}
              open={tagPendingDelete !== null}
            >
              <AlertDialogContent size="sm">
                <AlertDialogHeader>
                  <AlertDialogMedia>
                    <UiIcon name="alert-triangle" size={24} />
                  </AlertDialogMedia>
                  <AlertDialogTitle>{t("classification.tagsDeleteTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("classification.tagsDeleteDescription", {
                      name: tagPendingDelete?.name ?? "",
                    })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("classification.tagsDeleteCancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmDeleteTag} variant="destructive">
                    {t("classification.tagsDeleteConfirm")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        );
      }}
    />
  );
}
