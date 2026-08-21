"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { FacetMultiselect } from "@/components/facet-multiselect";
import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { FilterSection } from "@/components/ui/filter-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BookFormatFilter } from "@/features/books";
import { ownershipStatuses, readingStatuses } from "@/lib/book-status";
import { ListDetailsControllerDetailOwnerItem } from "@/shared/api/generated/model";

import type { ListDetailQueryState } from "../model/list-detail-query";
import type { UseListDetailQueryResult } from "../model/use-list-detail-query";

import { useListFacets } from "../api/use-list-facets";
import { activeListDetailFilterCount, LIST_DETAIL_VALUES } from "../model/list-detail-query";
import { listDetailStatusPatch } from "../model/list-quick-filters";

const QUEUE_CHOICES = ["all", "in", "notIn"] as const;

const FAVORITE_CHOICES = ["all", "only", "without"] as const;

type ListFiltersDraft = Pick<
  ListDetailQueryState,
  "author" | "bookType" | "format" | "genre" | "inQueue" | "isFavorite" | "owner" | "status"
>;

const EMPTY_FILTERS: ListFiltersDraft = {
  author: [],
  bookType: null,
  format: [],
  genre: [],
  inQueue: null,
  isFavorite: null,
  owner: [],
  status: [],
};

type ListAdvancedFiltersProps = {
  id: string;
  setState: UseListDetailQueryResult["setState"];
  state: ListDetailQueryState;
};

export function ListAdvancedFilters({ id, setState, state }: ListAdvancedFiltersProps) {
  const t = useTranslations("lists.details.filters");
  const tStatus = useTranslations("books.readingStatus.options");
  const tOwner = useTranslations("books.ownershipStatus.options");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ListFiltersDraft>(() => draftFromState(state));
  const facets = useListFacets(id);

  const activeCount = activeListDetailFilterCount(state);
  const authorOptions = (facets.data?.authors ?? []).map((author) => ({
    count: author.count,
    label: author.name,
    value: author.id,
  }));
  const genreOptions = (facets.data?.genres ?? []).map((genre) => ({
    count: genre.count,
    label: genre.name,
    value: genre.key,
  }));
  const queueChoice = draft.inQueue === null ? "all" : draft.inQueue ? "in" : "notIn";
  const favoriteChoice = draft.isFavorite === null ? "all" : draft.isFavorite ? "only" : "without";

  function handleOpenChange(next: boolean) {
    if (next) setDraft(draftFromState(state));
    setOpen(next);
  }

  function apply() {
    void setState({
      author: emptyToNull(draft.author),
      bookType: draft.bookType,
      format: emptyToNull(draft.format),
      genre: emptyToNull(draft.genre),
      inQueue: draft.inQueue,
      isFavorite: draft.isFavorite,
      owner: emptyToNull(draft.owner),
      ...listDetailStatusPatch(draft.status),
    });
    setOpen(false);
  }

  const trigger = (
    <Button
      aria-label={activeCount > 0 ? t("activeCount", { count: activeCount }) : t("button")}
      className="h-10"
      type="button"
      variant="secondary"
    >
      <UiIcon name="funnel" size={16} />
      <span className="max-sm:sr-only">{t("button")}</span>
      {activeCount > 0 ? (
        <Badge className="ml-0.5" variant="secondary">
          {activeCount}
        </Badge>
      ) : null}
    </Button>
  );

  const groups = (
    <>
      <FilterSection title={t("groups.status")}>
        <ChipGroup
          label={t("groups.status")}
          mode="multi"
          onValueChange={(next) =>
            setDraft((prev) => ({
              ...prev,
              status: LIST_DETAIL_VALUES.status.filter((value) => next.includes(value)),
            }))
          }
          options={LIST_DETAIL_VALUES.status.map((value) => {
            const entry = readingStatuses.find((item) => item.value === value);
            return {
              icon: entry ? <UiIcon name={entry.icon} /> : undefined,
              label: tStatus(value),
              value,
            };
          })}
          size="sm"
          value={draft.status}
        />
      </FilterSection>

      <FilterSection title={t("groups.ownership")}>
        <ChipGroup
          label={t("groups.ownership")}
          mode="multi"
          onValueChange={(next) =>
            setDraft((prev) => ({
              ...prev,
              owner: LIST_DETAIL_VALUES.owner.filter((value) => next.includes(value)),
            }))
          }
          options={LIST_DETAIL_VALUES.owner.map((value) => {
            const entry = ownershipStatuses.find((item) => item.value === value);
            return {
              icon: entry ? <UiIcon name={entry.icon} /> : undefined,
              label:
                value === ListDetailsControllerDetailOwnerItem.none
                  ? t("ownership.none")
                  : tOwner(value),
              value,
            };
          })}
          size="sm"
          value={draft.owner}
        />
      </FilterSection>

      <BookFormatFilter
        onValueChange={(format) => setDraft((prev) => ({ ...prev, format }))}
        options={LIST_DETAIL_VALUES.format}
        value={draft.format}
      />

      <FilterSection title={t("groups.queue")}>
        <Select
          onValueChange={(next) =>
            setDraft((prev) => ({ ...prev, inQueue: queueChoiceToValue(next) }))
          }
          value={queueChoice}
        >
          <SelectTrigger
            aria-label={t("groups.queue")}
            className="h-10 w-full data-[size=default]:h-10"
            clearLabel={tCommon("clear")}
            isClearable={draft.inQueue !== null}
            onClear={() => setDraft((prev) => ({ ...prev, inQueue: null }))}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {QUEUE_CHOICES.map((choice) => (
              <SelectItem key={choice} value={choice}>
                {t(`queue.${choice}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterSection>

      <FilterSection title={t("groups.favorite")}>
        <Select
          onValueChange={(next) =>
            setDraft((prev) => ({ ...prev, isFavorite: favoriteChoiceToValue(next) }))
          }
          value={favoriteChoice}
        >
          <SelectTrigger
            aria-label={t("groups.favorite")}
            className="h-10 w-full data-[size=default]:h-10"
            clearLabel={tCommon("clear")}
            isClearable={draft.isFavorite !== null}
            onClear={() => setDraft((prev) => ({ ...prev, isFavorite: null }))}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FAVORITE_CHOICES.map((choice) => (
              <SelectItem key={choice} value={choice}>
                {t(`favorite.${choice}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterSection>

      <FilterSection title={t("groups.author")}>
        <FacetMultiselect
          emptyText={t("author.empty")}
          label={t("groups.author")}
          onValueChange={(next) => setDraft((prev) => ({ ...prev, author: next }))}
          options={authorOptions}
          placeholder={t("author.placeholder")}
          searchPlaceholder={t("author.search")}
          selectedText={(count) => t("author.selected", { count })}
          value={draft.author}
        />
      </FilterSection>

      <FilterSection title={t("groups.genre")}>
        <FacetMultiselect
          emptyText={t("genre.empty")}
          label={t("groups.genre")}
          onValueChange={(next) => setDraft((prev) => ({ ...prev, genre: next }))}
          options={genreOptions}
          placeholder={t("genre.placeholder")}
          searchPlaceholder={t("genre.search")}
          selectedText={(count) => t("genre.selected", { count })}
          value={draft.genre}
        />
      </FilterSection>

      <FilterSection title={t("groups.bookType")}>
        <Select
          onValueChange={(next) =>
            setDraft((prev) => ({
              ...prev,
              bookType: LIST_DETAIL_VALUES.bookType.find((value) => value === next) ?? null,
            }))
          }
          value={draft.bookType ?? "all"}
        >
          <SelectTrigger
            aria-label={t("groups.bookType")}
            className="h-10 w-full data-[size=default]:h-10"
            clearLabel={tCommon("clear")}
            isClearable={draft.bookType !== null}
            onClear={() => setDraft((prev) => ({ ...prev, bookType: null }))}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("bookType.all")}</SelectItem>
            {LIST_DETAIL_VALUES.bookType.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`bookType.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterSection>
    </>
  );

  const footer = (
    <>
      <Button
        disabled={activeListDetailFilterCount({ ...state, ...draft }) === 0}
        onClick={() => setDraft(EMPTY_FILTERS)}
        type="button"
        variant="ghost"
      >
        {t("reset")}
      </Button>
      <Button onClick={apply} type="button">
        {t("apply")}
      </Button>
    </>
  );

  return (
    <Sheet onOpenChange={handleOpenChange} open={open}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="gap-0 data-[side=right]:w-full sm:max-w-md" side="right">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">{groups}</div>
        <SheetFooter>{footer}</SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function draftFromState(state: ListDetailQueryState): ListFiltersDraft {
  return {
    author: state.author,
    bookType: state.bookType,
    format: state.format,
    genre: state.genre,
    inQueue: state.inQueue,
    isFavorite: state.isFavorite,
    owner: state.owner,
    status: state.status,
  };
}

function emptyToNull<TValue>(values: TValue[]): null | TValue[] {
  return values.length === 0 ? null : values;
}

function favoriteChoiceToValue(choice: string): boolean | null {
  if (choice === "only") return true;
  if (choice === "without") return false;
  return null;
}

function queueChoiceToValue(choice: string): boolean | null {
  if (choice === "in") return true;
  if (choice === "notIn") return false;
  return null;
}
