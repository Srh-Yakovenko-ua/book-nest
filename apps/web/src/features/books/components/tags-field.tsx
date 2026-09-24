"use client";

import { TAG_NAME_ALLOWED_CHARS, TAG_NAME_MAX, TAG_NAME_MIN, type TagColor } from "@app/shared";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { type Control, Controller, type FieldErrors } from "react-hook-form";

import { UiIcon } from "@/components/icons";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { TagInput } from "@/components/ui/tag-input";
import { TagChip } from "@/features/tags/components/tag-chip";
import { TAG_COLOR_STYLES } from "@/features/tags/model/tag-color";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

import type { CreateBookFormValues } from "../model/create-book-form";

import { useTagsSearch } from "../api/use-tags-search";

const BOOK_TAGS_MAX = 12;
const SEARCH_DEBOUNCE_MS = 250;

type TagsFieldProps = {
  control: Control<CreateBookFormValues>;
  errors: FieldErrors<CreateBookFormValues>;
  tagColorOf: (name: string) => TagColor;
};

export function TagsField({ control, errors, tagColorOf }: TagsFieldProps) {
  const t = useTranslations("books");
  const listId = useId();
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedDraft = useDebouncedValue(draft, SEARCH_DEBOUNCE_MS);
  const tagsQuery = useTagsSearch(debouncedDraft);
  const existingTags = tagsQuery.data ?? [];
  const isFetching = tagsQuery.isFetching;

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
        const suggestions = existingTags.filter(
          (tag) => !normalizedSelected.has(tag.name.toLowerCase()),
        );
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
                    atMax={atMax}
                    chipStyle={(tag) => {
                      const colors = TAG_COLOR_STYLES[tagColorOf(tag)];
                      return { backgroundColor: colors.bg, color: colors.text };
                    }}
                    id="book-tags"
                    inputClassName={atMax ? "basis-full" : undefined}
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
                  <CommandList
                    onScroll={(event) => {
                      const list = event.currentTarget;
                      if (
                        tagsQuery.hasNextPage &&
                        !tagsQuery.isFetchingNextPage &&
                        list.scrollHeight - list.scrollTop - list.clientHeight < 48
                      ) {
                        void tagsQuery.fetchNextPage();
                      }
                    }}
                  >
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
                            className="cursor-pointer [&>svg:last-child]:hidden"
                            key={tag.id}
                            onSelect={() => addTag(tag.name)}
                            value={tag.id}
                          >
                            <TagChip className="py-0.5 text-xs" color={tag.color} name={tag.name} />
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
                    {tagsQuery.isFetchingNextPage ? (
                      <div className="px-3 py-2 text-center text-xs text-muted-foreground">
                        {t("classification.tagsSearching")}
                      </div>
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
          </>
        );
      }}
    />
  );
}
