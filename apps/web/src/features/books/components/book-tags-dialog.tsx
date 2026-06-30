"use client";

import { TAG_NAME_ALLOWED_CHARS, TAG_NAME_MAX, TAG_NAME_MIN } from "@app/shared";
import { Command as CommandPrimitive } from "cmdk";
import { useTranslations } from "next-intl";
import { type KeyboardEvent, useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

import { useTagsSearch } from "../api/use-tags-search";

const BOOK_TAGS_MAX = 12;
const SUGGESTION_LIMIT = 8;
const SEARCH_DEBOUNCE_MS = 250;

type BookTagsDialogProps = {
  bookCount: number;
  onConfirm: (tags: string[]) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function BookTagsDialog({ bookCount, onConfirm, onOpenChange, open }: BookTagsDialogProps) {
  const t = useTranslations("books.library.tagsDialog");
  const tClass = useTranslations("books.classification");
  const [tags, setTags] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const debouncedDraft = useDebouncedValue(draft, SEARCH_DEBOUNCE_MS);
  const { data: existingTags = [], isFetching } = useTagsSearch(debouncedDraft);

  const trimmedDraft = draft.trim();
  const atMax = tags.length >= BOOK_TAGS_MAX;
  const normalizedSelected = new Set(tags.map((tag) => tag.toLowerCase()));
  const suggestions = existingTags
    .filter((tag) => !normalizedSelected.has(tag.name.toLowerCase()))
    .slice(0, SUGGESTION_LIMIT);
  const validationError = trimmedDraft.length > 0 ? validateTag(trimmedDraft) : undefined;
  const matchesSuggestion = suggestions.some(
    (tag) => tag.name.toLowerCase() === trimmedDraft.toLowerCase(),
  );
  const canCreate =
    !atMax &&
    trimmedDraft.length > 0 &&
    validationError === undefined &&
    !normalizedSelected.has(trimmedDraft.toLowerCase()) &&
    !matchesSuggestion;
  const showSearching = isFetching && suggestions.length === 0 && !canCreate;
  const showEmpty = !isFetching && suggestions.length === 0 && !canCreate;
  const canConfirm = tags.length > 0 && !isSubmitting;

  function validateTag(label: string): string | undefined {
    if (label.length < TAG_NAME_MIN) return tClass("tagsTooShort");
    if (label.length > TAG_NAME_MAX) return tClass("tagsTooLong");
    if (!TAG_NAME_ALLOWED_CHARS.test(label)) return tClass("tagsInvalidChars");
    return undefined;
  }

  function commitTag(rawName: string) {
    const label = rawName.trim();
    if (label === "" || atMax) return;
    if (normalizedSelected.has(label.toLowerCase())) {
      setDraft("");
      return;
    }
    if (validateTag(label) !== undefined) return;
    setTags([...tags, label]);
    setDraft("");
  }

  function removeTag(target: string) {
    setTags(tags.filter((tag) => tag !== target));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === ",") {
      event.preventDefault();
      commitTag(draft);
      return;
    }
    if (event.key === "Backspace" && draft === "" && tags.length > 0) {
      const last = tags.at(-1);
      if (last !== undefined) removeTag(last);
    }
  }

  function reset() {
    setTags([]);
    setDraft("");
  }

  async function handleConfirm() {
    setIsSubmitting(true);
    try {
      await onConfirm(tags);
      reset();
      onOpenChange(false);
    } catch {
      return;
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (isSubmitting) return;
        if (!next) reset();
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description", { count: bookCount })}</DialogDescription>
        </DialogHeader>

        <CommandPrimitive
          className="flex flex-col gap-2"
          label={tClass("tags")}
          shouldFilter={false}
        >
          <span aria-hidden className="text-sm leading-none font-medium text-foreground">
            {tClass("tags")}
          </span>
          <Popover onOpenChange={setPopoverOpen} open={popoverOpen && !atMax}>
            <PopoverAnchor asChild>
              <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-md border border-input bg-field px-2.5 py-2 transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
                {tags.map((tag) => (
                  <span
                    className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border border-accent-border bg-accent py-0 pr-1.5 pl-3 text-xs font-medium whitespace-nowrap text-accent-foreground"
                    key={tag}
                  >
                    <span className="overflow-hidden text-ellipsis">{tag}</span>
                    <button
                      aria-label={t("removeTag", { name: tag })}
                      className="relative grid size-4.5 shrink-0 cursor-pointer place-items-center rounded-full text-accent-foreground opacity-65 transition-[opacity,background-color] after:absolute after:-inset-[3px] hover:bg-accent-foreground/15 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                      onClick={() => removeTag(tag)}
                      type="button"
                    >
                      <UiIcon className="size-3" name="x" size={12} />
                    </button>
                  </span>
                ))}
                <CommandPrimitive.Input
                  className="h-7 min-w-[90px] flex-1 border-0 bg-transparent text-sm text-ink outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
                  disabled={atMax}
                  onFocus={() => setPopoverOpen(true)}
                  onKeyDown={handleKeyDown}
                  onValueChange={(next) => {
                    setDraft(next);
                    setPopoverOpen(true);
                  }}
                  placeholder={atMax ? tClass("tagsAtMax") : tClass("tagsPlaceholder")}
                  value={draft}
                />
              </div>
            </PopoverAnchor>
            <PopoverContent
              align="start"
              className="w-[--radix-popover-trigger-width] min-w-[var(--radix-popover-anchor-width)] p-1"
              onOpenAutoFocus={(event) => event.preventDefault()}
              sideOffset={6}
            >
              <CommandList>
                {showSearching ? <CommandEmpty>{tClass("tagsSearching")}</CommandEmpty> : null}
                {showEmpty ? (
                  <CommandEmpty>{validationError ?? tClass("tagsEmpty")}</CommandEmpty>
                ) : null}
                {canCreate ? (
                  <CommandGroup heading={tClass("tagsCreateHeading")}>
                    <CommandItem
                      className="cursor-pointer"
                      onSelect={() => commitTag(trimmedDraft)}
                      value={`create-${trimmedDraft}`}
                    >
                      <UiIcon className="text-primary" name="plus" size={16} />
                      <span className="min-w-0 truncate">
                        {tClass("tagsCreate", { name: trimmedDraft })}
                      </span>
                    </CommandItem>
                  </CommandGroup>
                ) : null}
                {suggestions.length > 0 ? (
                  <CommandGroup heading={tClass("tagsSuggestions")}>
                    {suggestions.map((tag) => (
                      <CommandItem
                        className="cursor-pointer"
                        key={tag.id}
                        onSelect={() => commitTag(tag.name)}
                        value={tag.id}
                      >
                        <UiIcon className="text-muted-foreground" name="tag" size={16} />
                        <span className="min-w-0 truncate">{tag.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
              </CommandList>
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground">
            {tClass("tagsHint", { max: BOOK_TAGS_MAX })}
          </p>
        </CommandPrimitive>

        <DialogFooter>
          <Button disabled={isSubmitting} onClick={() => onOpenChange(false)} variant="secondary">
            {t("cancel")}
          </Button>
          <Button
            disabled={!canConfirm}
            loading={isSubmitting}
            onClick={() => void handleConfirm()}
          >
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
