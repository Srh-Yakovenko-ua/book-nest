"use client";

import type { Nullable } from "@app/shared";

import {
  RELATIONSHIP_CATEGORY_TYPES,
  RelationshipCategorySchema,
  RelationshipTypeSchema,
} from "@app/shared";
import { useTranslations } from "next-intl";

import { ChipGroup } from "@/components/ui/chip-group";
import { Multiselect } from "@/components/ui/multiselect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { RelationshipBookOption } from "../model/relationship-adapter";
import type {
  RelationshipAdvancedFilters,
  RelationshipCanonicalFilter,
} from "../model/relationship-list-query";

import { useRelationshipLabels } from "../model/use-relationship-labels";

const RELATIONSHIP_FILTERS = {
  anyBook: "__any__",
  canonicalChoices: [
    { filter: null, key: "any" },
    { filter: "true", key: "canonical" },
    { filter: "false", key: "nonCanonical" },
  ],
} as const satisfies {
  anyBook: string;
  canonicalChoices: readonly { filter: Nullable<RelationshipCanonicalFilter>; key: string }[];
};

type RelationshipFilterFieldProps = {
  draft: RelationshipAdvancedFilters;
  onChange: (patch: Partial<RelationshipAdvancedFilters>) => void;
};

export function RelationshipBookField({
  bookOptions,
  draft,
  onChange,
}: RelationshipFilterFieldProps & { bookOptions: readonly RelationshipBookOption[] }) {
  const t = useTranslations("relationships.filters.book");

  return (
    <Select
      onValueChange={(next) =>
        onChange({ relBook: next === RELATIONSHIP_FILTERS.anyBook ? null : next })
      }
      value={draft.relBook ?? RELATIONSHIP_FILTERS.anyBook}
    >
      <SelectTrigger aria-label={t("label")} className="w-full data-[size=default]:h-10">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={RELATIONSHIP_FILTERS.anyBook}>{t("any")}</SelectItem>
        {bookOptions.map((book) => (
          <SelectItem key={book.id} value={book.id}>
            {book.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function RelationshipCanonicalField({ draft, onChange }: RelationshipFilterFieldProps) {
  const t = useTranslations("relationships.filters.canonical");
  const selected =
    RELATIONSHIP_FILTERS.canonicalChoices.find((choice) => choice.filter === draft.relCanon) ??
    RELATIONSHIP_FILTERS.canonicalChoices[0];

  return (
    <ChipGroup
      label={t("label")}
      mode="single"
      onValueChange={(next) => {
        const choice = RELATIONSHIP_FILTERS.canonicalChoices.find((option) => option.key === next);
        if (choice !== undefined) onChange({ relCanon: choice.filter });
      }}
      options={RELATIONSHIP_FILTERS.canonicalChoices.map((choice) => ({
        label: t(choice.key),
        value: choice.key,
      }))}
      size="sm"
      value={selected.key}
    />
  );
}

export function RelationshipTypeField({ draft, onChange }: RelationshipFilterFieldProps) {
  const t = useTranslations("relationships.filters.types");
  const labels = useRelationshipLabels();
  const options = RelationshipCategorySchema.options.flatMap((category) =>
    RELATIONSHIP_CATEGORY_TYPES[category].map((type) => ({
      group: labels.category(category),
      label: labels.type(type),
      value: type,
    })),
  );

  return (
    <Multiselect
      emptyText={t("empty")}
      onValueChange={(next) =>
        onChange({
          relType: RelationshipTypeSchema.options.filter((type) => next.includes(type)),
        })
      }
      options={options}
      placeholder={t("placeholder")}
      searchPlaceholder={t("search")}
      value={draft.relType}
    />
  );
}
