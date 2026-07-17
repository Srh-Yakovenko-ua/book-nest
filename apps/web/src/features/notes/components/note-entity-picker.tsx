"use client";

import type { NoteEntityType, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

import type { NoteEntityRef } from "../model/note-entity";

import { useNoteBookOptions } from "../api/use-note-book-options";
import { useNoteSeriesOptions } from "../api/use-note-series-options";
import { noteEntityRefFromBook, noteEntityRefFromSeries } from "../model/note-entity-options";

const SEARCH_DEBOUNCE_MS = 250;

type NoteEntityPickerProps = {
  onSelect: (entity: NoteEntityRef) => void;
};

export function NoteEntityPicker({ onSelect }: NoteEntityPickerProps) {
  const [entityType, setEntityType] = useState<Nullable<NoteEntityType>>(null);

  if (entityType === null) return <EntityTypeStep onSelect={setEntityType} />;

  return (
    <EntitySearchStep
      entityType={entityType}
      onBack={() => setEntityType(null)}
      onSelect={onSelect}
    />
  );
}

function BookOptions({
  onSelect,
  search,
}: {
  onSelect: (entity: NoteEntityRef) => void;
  search: string;
}) {
  const t = useTranslations("notes.archive.picker");
  const tEntity = useTranslations("notes.entity");
  const { data: books, isPending } = useNoteBookOptions(search);

  if (isPending) return <CommandEmpty>{t("searching")}</CommandEmpty>;
  if (books === undefined || books.length === 0) return <CommandEmpty>{t("empty")}</CommandEmpty>;

  return (
    <CommandGroup>
      {books.map((book) => (
        <CommandItem
          className="cursor-pointer items-start"
          key={book.id}
          onSelect={() => onSelect(noteEntityRefFromBook(book))}
          value={book.id}
        >
          <UiIcon className="mt-0.5 shrink-0 text-muted-foreground" name="book" size={16} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{book.title}</span>
            <span className="truncate text-xs text-muted-foreground">
              {book.authors[0]?.name ?? tEntity("authorsUnknown")}
            </span>
          </span>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

function EntitySearchStep({
  entityType,
  onBack,
  onSelect,
}: {
  entityType: NoteEntityType;
  onBack: () => void;
  onSelect: (entity: NoteEntityRef) => void;
}) {
  const t = useTranslations("notes.archive.picker");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  return (
    <div className="flex flex-col gap-3">
      <Button className="self-start" onClick={onBack} size="sm" variant="ghost">
        <UiIcon name="arrow-left" size={14} />
        {t("back")}
      </Button>

      <Command
        className="rounded-xl! border border-border bg-card"
        label={t(entityType === "book" ? "searchBookLabel" : "searchSeriesLabel")}
        shouldFilter={false}
      >
        <CommandInput
          onValueChange={setSearch}
          placeholder={t(
            entityType === "book" ? "searchBookPlaceholder" : "searchSeriesPlaceholder",
          )}
          value={search}
        />
        <CommandList>
          {entityType === "book" ? (
            <BookOptions onSelect={onSelect} search={debouncedSearch} />
          ) : (
            <SeriesOptions onSelect={onSelect} search={debouncedSearch} />
          )}
        </CommandList>
      </Command>
    </div>
  );
}

function EntityTypeCard({
  description,
  icon,
  label,
  onClick,
}: {
  description: string;
  icon: "book" | "layers";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex cursor-pointer flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 text-left transition-colors outline-none hover:border-accent-border hover:bg-secondary focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      onClick={onClick}
      type="button"
    >
      <span className="grid size-9 place-items-center rounded-lg bg-accent text-icon">
        <UiIcon name={icon} size={18} />
      </span>
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="text-xs leading-relaxed text-muted-foreground">{description}</span>
    </button>
  );
}

function EntityTypeStep({ onSelect }: { onSelect: (entityType: NoteEntityType) => void }) {
  const t = useTranslations("notes.archive.picker");

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t("typeHint")}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <EntityTypeCard
          description={t("typeBookDescription")}
          icon="book"
          label={t("typeBook")}
          onClick={() => onSelect("book")}
        />
        <EntityTypeCard
          description={t("typeSeriesDescription")}
          icon="layers"
          label={t("typeSeries")}
          onClick={() => onSelect("series")}
        />
      </div>
    </div>
  );
}

function SeriesOptions({
  onSelect,
  search,
}: {
  onSelect: (entity: NoteEntityRef) => void;
  search: string;
}) {
  const t = useTranslations("notes.archive.picker");
  const tEntity = useTranslations("notes.entity");
  const { data: series, isPending } = useNoteSeriesOptions(search);

  if (isPending) return <CommandEmpty>{t("searching")}</CommandEmpty>;
  if (series === undefined || series.length === 0) return <CommandEmpty>{t("empty")}</CommandEmpty>;

  return (
    <CommandGroup>
      {series.map((item) => (
        <CommandItem
          className="cursor-pointer items-start"
          key={item.id}
          onSelect={() => onSelect(noteEntityRefFromSeries(item))}
          value={item.id}
        >
          <UiIcon className="mt-0.5 shrink-0 text-muted-foreground" name="layers" size={16} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{item.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {item.authors.length === 0
                ? tEntity("authorsUnknown")
                : item.authors.map((author) => author.name).join(", ")}
            </span>
          </span>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
