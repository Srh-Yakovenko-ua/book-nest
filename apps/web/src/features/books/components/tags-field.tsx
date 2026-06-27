"use client";

import type { TagView } from "@app/shared";

import { TAG_NAME_ALLOWED_CHARS, TAG_NAME_MAX, TAG_NAME_MIN } from "@app/shared";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { TagInput } from "@/components/ui/tag-input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

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
  const listId = useId();
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
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
        const trimmedDraft = draft.trim();
        const draftIsNewTag =
          trimmedDraft.length > 0 &&
          validateTag(trimmedDraft) === undefined &&
          !normalizedSelected.has(trimmedDraft.toLowerCase()) &&
          !existingTags.some((tag) => tag.name.toLowerCase() === trimmedDraft.toLowerCase());
        const isLoading = isFetching && suggestions.length === 0;
        const isEmpty = !isFetching && suggestions.length === 0 && !draftIsNewTag;

        function setTags(next: string[]) {
          field.onChange(next.slice(0, BOOK_TAGS_MAX));
        }

        function addTag(name: string) {
          if (atMax) return;
          if (normalizedSelected.has(name.toLowerCase())) return;
          setTags([...value, name]);
        }

        return (
          <>
            <Popover onOpenChange={setOpen} open={open && !atMax}>
              <PopoverAnchor asChild>
                <div>
                  <TagInput
                    aria-autocomplete="list"
                    aria-controls={open && !atMax ? listId : undefined}
                    aria-describedby={tagsErrorMessage ? "book-tags-error" : undefined}
                    aria-expanded={open && !atMax}
                    aria-invalid={tagsErrorMessage !== undefined}
                    disabled={atMax}
                    id="book-tags"
                    onFocus={() => setOpen(true)}
                    onInputChange={setDraft}
                    onValueChange={setTags}
                    placeholder={
                      atMax ? t("classification.tagsAtMax") : t("classification.tagsPlaceholder")
                    }
                    role="combobox"
                    validateTag={validateTag}
                    value={value}
                  />
                </div>
              </PopoverAnchor>
              <PopoverContent
                align="start"
                className="w-[--radix-popover-trigger-width] min-w-[var(--radix-popover-anchor-width)] p-0"
                onOpenAutoFocus={(event) => event.preventDefault()}
                sideOffset={6}
              >
                <Command id={listId} shouldFilter={false}>
                  <CommandList>
                    {isLoading ? (
                      <CommandEmpty>{t("classification.tagsSearching")}</CommandEmpty>
                    ) : null}
                    {isEmpty ? (
                      <CommandEmpty>
                        {trimmedDraft.length > 0
                          ? t("classification.tagsEmpty")
                          : t("classification.tagsNoSaved")}
                      </CommandEmpty>
                    ) : null}
                    {suggestions.length > 0 ? (
                      <CommandGroup heading={t("classification.tagsSuggestions")}>
                        {suggestions.map((tag) => (
                          <CommandItem
                            className="cursor-pointer"
                            key={tag.id}
                            onSelect={() => addTag(tag.name)}
                            value={tag.id}
                          >
                            <UiIcon className="text-muted-foreground" name="tag" size={16} />
                            <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                            <button
                              aria-label={t("classification.tagsDeleteSaved", { name: tag.name })}
                              className="relative grid size-[18px] shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground opacity-70 transition-[opacity,background-color] after:absolute after:-inset-[3px] hover:bg-destructive/15 hover:text-destructive hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                              onClick={(event) => {
                                event.stopPropagation();
                                setTagPendingDelete(tag);
                              }}
                              onPointerDown={(event) => event.stopPropagation()}
                              type="button"
                            >
                              <UiIcon className="size-3" name="x" size={12} />
                            </button>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ) : null}
                    {draftIsNewTag ? (
                      <CommandGroup heading={t("classification.tagsCreateHeading")}>
                        <CommandItem
                          className="cursor-pointer"
                          onSelect={() => addTag(trimmedDraft)}
                          value="__create__"
                        >
                          <UiIcon className="text-primary" name="plus" size={16} />
                          <span className="min-w-0 truncate">
                            {t("classification.tagsCreate", { name: trimmedDraft })}
                          </span>
                        </CommandItem>
                      </CommandGroup>
                    ) : null}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              {t("classification.tagsHint", { max: BOOK_TAGS_MAX })}
            </p>
            {tagsErrorMessage ? (
              <p className="text-xs text-destructive" id="book-tags-error" role="alert">
                {tagsErrorMessage}
              </p>
            ) : null}
            <AlertDialog
              onOpenChange={(nextOpen) => {
                if (!nextOpen) setTagPendingDelete(null);
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
