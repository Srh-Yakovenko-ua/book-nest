"use client";

import type { AuthorView } from "@app/shared";

import { BOOK_AUTHORS_MAX, TaxonomyNameSchema } from "@app/shared";
import { Command as CommandPrimitive } from "cmdk";
import { useTranslations } from "next-intl";
import { type KeyboardEvent, useState } from "react";

import { UiIcon } from "@/components/icons";
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

import { useAuthorOptions } from "../api/use-author-options";
import { useRecentAuthors } from "../api/use-recent-authors";
import { type AuthorSelection } from "../model/create-book-form";

const SEARCH_DEBOUNCE_MS = 250;
const MIN_CREATE_LENGTH = 2;
const SUGGESTION_LIMIT = 8;

type AuthorsFieldProps = {
  describedBy?: string;
  id: string;
  invalid: boolean;
  onChange: (next: AuthorSelection[]) => void;
  value: AuthorSelection[];
};

export function AuthorsField({ describedBy, id, invalid, onChange, value }: AuthorsFieldProps) {
  const t = useTranslations("books");
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedDraft = useDebouncedValue(draft, SEARCH_DEBOUNCE_MS);
  const recent = useRecentAuthors();
  const { data: allAuthors = [], isFetching } = useAuthorOptions(debouncedDraft);

  const atMax = value.length >= BOOK_AUTHORS_MAX;
  const trimmedDraft = draft.trim();
  const query = trimmedDraft.toLowerCase();
  const selectedIds = new Set(
    value.flatMap((author) => (author.kind === "catalog" ? [author.id] : [])),
  );
  const selectedNames = new Set(value.map((author) => author.name.toLowerCase()));

  function isSelectedCatalog(author: AuthorView) {
    return selectedIds.has(author.id);
  }

  function matchesQuery(name: string) {
    return query.length === 0 || name.toLowerCase().includes(query);
  }

  const recentOptions = (recent.data ?? [])
    .filter((author) => !isSelectedCatalog(author) && matchesQuery(author.name))
    .slice(0, SUGGESTION_LIMIT);
  const recentIds = new Set(recentOptions.map((author) => author.id));
  const allOptions = allAuthors
    .filter(
      (author) =>
        !isSelectedCatalog(author) && !recentIds.has(author.id) && matchesQuery(author.name),
    )
    .slice(0, SUGGESTION_LIMIT);

  const exactMatchExists = [...(recent.data ?? []), ...allAuthors].some(
    (author) => author.name.toLowerCase() === query,
  );
  const draftIsValidCustom = TaxonomyNameSchema.safeParse(trimmedDraft).success;
  const draftIsNewAuthor =
    trimmedDraft.length >= MIN_CREATE_LENGTH &&
    draftIsValidCustom &&
    !selectedNames.has(query) &&
    !exactMatchExists;

  const hasOptions = recentOptions.length > 0 || allOptions.length > 0;
  const isLoading = (isFetching || recent.isFetching) && !hasOptions;
  const isEmpty = !isLoading && !hasOptions && !draftIsNewAuthor;

  function addCatalog(author: AuthorView) {
    if (atMax || selectedIds.has(author.id)) return;
    onChange([...value, { id: author.id, kind: "catalog", name: author.name }]);
    setDraft("");
  }

  function addCustom() {
    if (atMax || selectedNames.has(query) || !draftIsValidCustom) return;
    onChange([...value, { kind: "custom", name: trimmedDraft }]);
    setDraft("");
  }

  function removeAt(index: number) {
    onChange(value.filter((_, position) => position !== index));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && draft === "" && value.length > 0) {
      event.preventDefault();
      removeAt(value.length - 1);
    }
  }

  function authorItem(author: AuthorView) {
    return (
      <CommandItem
        className="cursor-pointer"
        key={author.id}
        onSelect={() => addCatalog(author)}
        value={author.id}
      >
        <UiIcon className="text-muted-foreground" name="user" size={16} />
        <span className="min-w-0 truncate">{author.name}</span>
        {author.isCustom ? (
          <span className="ml-auto text-xs text-muted-foreground">{t("author.customBadge")}</span>
        ) : null}
      </CommandItem>
    );
  }

  const inputPlaceholder = atMax
    ? t("fields.authorsAtMax")
    : value.length > 0
      ? ""
      : t("fields.authorPlaceholder");

  return (
    <CommandPrimitive label={t("fields.author")} shouldFilter={false}>
      <Popover onOpenChange={setOpen} open={open && !atMax}>
        <PopoverAnchor asChild>
          <div
            className={cn(
              "flex min-h-12 cursor-text flex-wrap items-center gap-2 rounded-md border border-input bg-field px-2.5 py-2 transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
              invalid &&
                "border-destructive focus-within:border-destructive focus-within:ring-destructive/20",
            )}
            data-slot="authors-field"
          >
            {value.map((author, index) => (
              <span
                className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border border-accent-border bg-accent py-0 pr-1.5 pl-3 text-[0.8125rem] font-medium whitespace-nowrap text-accent-foreground"
                key={author.kind === "catalog" ? author.id : `custom:${author.name}`}
              >
                <span className="overflow-hidden text-ellipsis">{author.name}</span>
                <button
                  aria-label={t("fields.authorsRemove", { name: author.name })}
                  className="relative grid size-[18px] shrink-0 cursor-pointer place-items-center rounded-full text-accent-foreground opacity-65 transition-[opacity,background-color] after:absolute after:-inset-[3px] hover:bg-accent-foreground/15 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  onClick={() => removeAt(index)}
                  type="button"
                >
                  <UiIcon className="size-3" name="x" size={12} />
                </button>
              </span>
            ))}
            <CommandPrimitive.Input
              aria-describedby={describedBy}
              aria-expanded={open && !atMax}
              aria-invalid={invalid}
              aria-required
              autoComplete="off"
              className="h-7 min-w-[90px] flex-1 border-0 bg-transparent text-[0.9375rem] text-ink outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
              disabled={atMax}
              id={id}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
              onValueChange={(next) => {
                setDraft(next);
                setOpen(true);
              }}
              placeholder={inputPlaceholder}
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
            {isLoading ? <CommandEmpty>{t("author.searching")}</CommandEmpty> : null}
            {isEmpty ? <CommandEmpty>{t("author.empty")}</CommandEmpty> : null}
            {recentOptions.length > 0 ? (
              <CommandGroup heading={t("author.recentHeading")}>
                {recentOptions.map(authorItem)}
              </CommandGroup>
            ) : null}
            {allOptions.length > 0 ? (
              <CommandGroup heading={t("author.allHeading")}>
                {allOptions.map(authorItem)}
              </CommandGroup>
            ) : null}
            {draftIsNewAuthor ? (
              <CommandGroup heading={t("author.createHeading")}>
                <CommandItem
                  className="cursor-pointer"
                  onSelect={addCustom}
                  value={`create-${query}`}
                >
                  <UiIcon className="text-primary" name="plus" size={16} />
                  <span className="min-w-0 truncate">
                    {t("author.create", { name: trimmedDraft })}
                  </span>
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </PopoverContent>
      </Popover>
    </CommandPrimitive>
  );
}
