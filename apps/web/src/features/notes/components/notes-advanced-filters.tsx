"use client";

import type { Nullable } from "@app/shared";

import { SeriesReadingStateSchema, SeriesStatusSchema } from "@app/shared";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { FacetOption } from "@/components/facet-multiselect";

import { FacetMultiselect } from "@/components/facet-multiselect";
import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { FilterSection } from "@/components/ui/filter-panel";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useGenres } from "@/features/books";
import { assertNever } from "@/lib/assert-never";
import { cn } from "@/lib/utils";

import type { NotesArchiveFacets } from "../api/use-notes-facets";
import type {
  NotesArchiveConfig,
  NotesArchiveDimension,
  NotesFacetDimension,
  NotesPresenceDimension,
} from "../model/notes-archive-config";
import type { NotesAdvancedValues } from "../model/notes-archive-query";

import { NOTES_ARCHIVE } from "../model/notes-archive-query";
import {
  customCategorySelectionValue,
  fromCategorySelectionValues,
  standardCategorySelectionValue,
  toCategorySelectionValues,
} from "../model/notes-category-selection";

const PRESENCE_OPTIONS = ["any", "yes", "no"] as const;

type DimensionFieldProps = {
  draft: NotesAdvancedValues;
  facets: NotesArchiveFacets | undefined;
  onChange: (patch: Partial<NotesAdvancedValues>) => void;
};

type NotesAdvancedFiltersProps = {
  activeCount: number;
  config: NotesArchiveConfig;
  facets: NotesArchiveFacets | undefined;
  onApply: (values: NotesAdvancedValues) => void;
  values: NotesAdvancedValues;
};

type Presence = (typeof PRESENCE_OPTIONS)[number];

export function NotesAdvancedFilters({
  activeCount,
  config,
  facets,
  onApply,
  values,
}: NotesAdvancedFiltersProps) {
  const t = useTranslations("notes.archive.advancedFilters");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<NotesAdvancedValues>(values);

  function patchDraft(patch: Partial<NotesAdvancedValues>) {
    setDraft((previous) => ({ ...previous, ...patch }));
  }

  return (
    <Sheet
      onOpenChange={(next) => {
        if (next) setDraft(values);
        setOpen(next);
      }}
      open={open}
    >
      <SheetTrigger asChild>
        <Button
          className={cn("h-10", activeCount > 0 ? "max-sm:px-2.5" : "max-sm:w-10 max-sm:px-0")}
          type="button"
          variant="secondary"
        >
          <UiIcon name="funnel" size={16} />
          <span className="max-sm:sr-only">{t("trigger")}</span>
          {activeCount > 0 ? (
            <Badge className="ml-0.5" variant="secondary">
              {activeCount}
            </Badge>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent className="gap-0 data-[side=right]:w-full sm:max-w-md" side="right">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          {config.dimensions.map((dimension) => (
            <FilterSection key={dimension} title={t(`sections.${dimension}`)}>
              <DimensionField
                dimension={dimension}
                draft={draft}
                facets={facets}
                onChange={patchDraft}
              />
            </FilterSection>
          ))}
        </div>

        <SheetFooter className="border-t">
          <Button
            onClick={() => setDraft(NOTES_ARCHIVE.emptyDimensions)}
            type="button"
            variant="ghost"
          >
            {t("clear")}
          </Button>
          <Button
            onClick={() => {
              onApply(draft);
              setOpen(false);
            }}
            type="button"
          >
            {t("apply")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function CategoryField({ draft, facets, onChange }: DimensionFieldProps) {
  const t = useTranslations("notes.archive.advancedFilters");
  const tCategories = useTranslations("notes.categories");

  const options: FacetOption[] = [
    ...(facets?.categories ?? []).map(({ category, count }) => ({
      count,
      label: tCategories(category),
      value: standardCategorySelectionValue(category),
    })),
    ...(facets?.customCategories ?? []).map(({ count, value }) => ({
      count,
      label: tCategories("custom", { value }),
      value: customCategorySelectionValue(value),
    })),
  ];

  return (
    <FacetMultiselect
      emptyText={t("fields.category.empty")}
      label={t("sections.category")}
      onValueChange={(next) => onChange(fromCategorySelectionValues(next))}
      options={options}
      placeholder={t("fields.category.placeholder")}
      searchPlaceholder={t("fields.category.search")}
      selectedText={(count) => t("selected", { count })}
      value={toCategorySelectionValues(draft)}
    />
  );
}

function DimensionField({
  dimension,
  ...props
}: DimensionFieldProps & { dimension: NotesArchiveDimension }) {
  switch (dimension) {
    case "author":
      return (
        <FacetField
          dimension="author"
          onValueChange={(author) => props.onChange({ author })}
          options={props.facets?.options.author ?? []}
          value={props.draft.author}
        />
      );
    case "book":
      return (
        <FacetField
          dimension="book"
          onValueChange={(book) => props.onChange({ book })}
          options={props.facets?.options.book ?? []}
          value={props.draft.book}
        />
      );
    case "category":
      return <CategoryField {...props} />;
    case "genre":
      return <GenreField {...props} />;
    case "hasChapter":
    case "hasPage":
      return (
        <PresenceField
          dimension={dimension}
          onChange={(value) =>
            props.onChange(dimension === "hasPage" ? { hasPage: value } : { hasChapter: value })
          }
          value={props.draft[dimension]}
        />
      );
    case "reading":
      return <ReadingField {...props} />;
    case "series":
      return (
        <FacetField
          dimension="series"
          onValueChange={(series) => props.onChange({ series })}
          options={props.facets?.options.series ?? []}
          value={props.draft.series}
        />
      );
    case "status":
      return <StatusField {...props} />;
    default:
      return assertNever(dimension);
  }
}

function FacetField({
  dimension,
  onValueChange,
  options,
  value,
}: {
  dimension: NotesFacetDimension;
  onValueChange: (next: string[]) => void;
  options: FacetOption[];
  value: string[];
}) {
  const t = useTranslations("notes.archive.advancedFilters");

  return (
    <FacetMultiselect
      emptyText={t(`fields.${dimension}.empty`)}
      label={t(`sections.${dimension}`)}
      onValueChange={onValueChange}
      options={options}
      placeholder={t(`fields.${dimension}.placeholder`)}
      searchPlaceholder={t(`fields.${dimension}.search`)}
      selectedText={(count) => t("selected", { count })}
      value={value}
    />
  );
}

function flagToPresence(flag: Nullable<boolean>): Presence {
  if (flag === null) return "any";
  return flag ? "yes" : "no";
}

function GenreField({ draft, facets, onChange }: DimensionFieldProps) {
  const genres = useGenres();
  const nameByKey = new Map((genres.data ?? []).map((genre) => [genre.key, genre.name]));

  return (
    <FacetField
      dimension="genre"
      onValueChange={(genre) => onChange({ genre })}
      options={(facets?.options.genre ?? []).map((option) => ({
        ...option,
        label: nameByKey.get(option.value) ?? option.label,
      }))}
      value={draft.genre}
    />
  );
}

function PresenceField({
  dimension,
  onChange,
  value,
}: {
  dimension: NotesPresenceDimension;
  onChange: (value: Nullable<boolean>) => void;
  value: Nullable<boolean>;
}) {
  const t = useTranslations("notes.archive.advancedFilters");

  return (
    <ChipGroup
      label={t(`sections.${dimension}`)}
      mode="single"
      onValueChange={(next) => {
        const match = PRESENCE_OPTIONS.find((option) => option === next);
        if (match !== undefined) onChange(presenceToFlag(match));
      }}
      options={PRESENCE_OPTIONS.map((option) => ({
        label: t(`presence.${option}`),
        value: option,
      }))}
      size="sm"
      value={flagToPresence(value)}
    />
  );
}

function presenceToFlag(presence: Presence): Nullable<boolean> {
  switch (presence) {
    case "any":
      return null;
    case "no":
      return false;
    case "yes":
      return true;
    default:
      return assertNever(presence);
  }
}

function ReadingField({ draft, onChange }: DimensionFieldProps) {
  const t = useTranslations("notes.archive.advancedFilters");
  const tReading = useTranslations("series.readingFilter");

  return (
    <ChipGroup
      label={t("sections.reading")}
      mode="multi"
      onValueChange={(next) =>
        onChange({
          reading: SeriesReadingStateSchema.options.filter((option) => next.includes(option)),
        })
      }
      options={SeriesReadingStateSchema.options.map((option) => ({
        label: tReading(option),
        value: option,
      }))}
      size="sm"
      value={draft.reading}
    />
  );
}

function StatusField({ draft, onChange }: DimensionFieldProps) {
  const t = useTranslations("notes.archive.advancedFilters");
  const tStatus = useTranslations("series.status");

  return (
    <ChipGroup
      label={t("sections.status")}
      mode="multi"
      onValueChange={(next) =>
        onChange({
          status: SeriesStatusSchema.options.filter((option) => next.includes(option)),
        })
      }
      options={SeriesStatusSchema.options.map((option) => ({
        label: tStatus(option),
        value: option,
      }))}
      size="sm"
      value={draft.status}
    />
  );
}
