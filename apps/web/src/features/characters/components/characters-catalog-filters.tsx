"use client";

import type {
  BookCharacterImportance,
  BookCharacterRoleType,
  CharacterAttitude,
  CharacterGender,
} from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

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
import { useSeriesPickerOptions } from "@/features/series";

import type { CharactersCatalogState } from "../model/characters-catalog-query";
import type { CharactersCatalogAdvancedPatch } from "../model/use-characters-catalog-query";

import { useCharacterGroupOptions } from "../api/use-character-group-options";
import {
  ATTITUDE_OPTIONS,
  BOOK_CHARACTER_IMPORTANCE,
  GENDER_OPTIONS,
  ROLE_TYPE_OPTIONS,
} from "../model/character-options";

type CharactersCatalogFiltersProps = {
  activeCount: number;
  onApply: (patch: CharactersCatalogAdvancedPatch) => void;
  state: CharactersCatalogState;
};

const EMPTY_ADVANCED = {
  attitude: [],
  gender: [],
  groupId: [],
  importance: [],
  role: [],
  seriesId: null,
} satisfies CharactersCatalogAdvancedPatch;

export function CharactersCatalogFilters({
  activeCount,
  onApply,
  state,
}: CharactersCatalogFiltersProps) {
  const t = useTranslations("characters.catalog.filters");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CharactersCatalogAdvancedPatch>(EMPTY_ADVANCED);

  function openWith(next: boolean) {
    if (next) {
      setDraft({
        attitude: state.attitude,
        gender: state.gender,
        groupId: state.groupId,
        importance: state.importance,
        role: state.role,
        seriesId: state.seriesId,
      });
    }
    setOpen(next);
  }

  return (
    <Sheet onOpenChange={openWith} open={open}>
      <SheetTrigger asChild>
        <Button className="h-10" variant="secondary">
          <UiIcon name="filter" size={16} />
          {t("trigger")}
          {activeCount > 0 ? <Badge variant="primary">{activeCount}</Badge> : null}
        </Button>
      </SheetTrigger>

      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md" side="right">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
          <FilterSection title={t("groups.appearsIn")}>
            <SeriesFilter
              onChange={(seriesId) => setDraft((current) => ({ ...current, seriesId }))}
              value={draft.seriesId ?? null}
            />
          </FilterSection>

          <FilterSection title={t("groups.bookRole")}>
            <ChipGroup
              label={t("importance")}
              mode="multi"
              onValueChange={(importance) => setDraft((current) => ({ ...current, importance }))}
              options={BOOK_CHARACTER_IMPORTANCE.options.map((option) => ({
                label: <ImportanceLabel value={option} />,
                value: option,
              }))}
              size="sm"
              value={draft.importance ?? []}
            />
            <ChipGroup
              label={t("role")}
              mode="multi"
              onValueChange={(role) => setDraft((current) => ({ ...current, role }))}
              options={ROLE_TYPE_OPTIONS.map((option) => ({
                label: <RoleLabel value={option} />,
                value: option,
              }))}
              size="sm"
              value={draft.role ?? []}
            />
          </FilterSection>

          <FilterSection title={t("groups.about")}>
            <ChipGroup
              label={t("gender")}
              mode="multi"
              onValueChange={(gender) => setDraft((current) => ({ ...current, gender }))}
              options={GENDER_OPTIONS.map((option) => ({
                label: <GenderLabel value={option} />,
                value: option,
              }))}
              size="sm"
              value={draft.gender ?? []}
            />
            <ChipGroup
              label={t("attitude")}
              mode="multi"
              onValueChange={(attitude) => setDraft((current) => ({ ...current, attitude }))}
              options={ATTITUDE_OPTIONS.map((option) => ({
                label: <AttitudeLabel value={option} />,
                value: option,
              }))}
              size="sm"
              value={draft.attitude ?? []}
            />
          </FilterSection>

          <FilterSection title={t("groups.organisation")}>
            <GroupFilter
              onChange={(groupId) => setDraft((current) => ({ ...current, groupId }))}
              value={draft.groupId ?? []}
            />
          </FilterSection>
        </div>

        <SheetFooter className="border-t border-border">
          <Button
            onClick={() => {
              setDraft(EMPTY_ADVANCED);
              onApply(EMPTY_ADVANCED);
              setOpen(false);
            }}
            variant="ghost"
          >
            {t("clear")}
          </Button>
          <Button
            onClick={() => {
              onApply(draft);
              setOpen(false);
            }}
          >
            {t("apply")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function AttitudeLabel({ value }: { value: CharacterAttitude }) {
  const t = useTranslations("characters.attitude");
  return <>{t(value)}</>;
}

function GenderLabel({ value }: { value: CharacterGender }) {
  const t = useTranslations("characters.gender");
  return <>{t(value)}</>;
}

function GroupFilter({
  onChange,
  value,
}: {
  onChange: (value: string[]) => void;
  value: string[];
}) {
  const t = useTranslations("characters.catalog.filters");
  const groups = useCharacterGroupOptions(true);
  const options = (groups.data?.items ?? []).filter((group) => group.name !== null);

  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noGroups")}</p>;
  }

  return (
    <ChipGroup
      label={t("groups.organisation")}
      mode="multi"
      onValueChange={onChange}
      options={options.map((group) => ({ label: group.name ?? "", value: group.id }))}
      size="sm"
      value={value}
    />
  );
}

function ImportanceLabel({ value }: { value: BookCharacterImportance }) {
  const t = useTranslations("characters.importance");
  return <>{t(value)}</>;
}

function RoleLabel({ value }: { value: BookCharacterRoleType }) {
  const t = useTranslations("characters.roleType");
  return <>{t(value)}</>;
}

function SeriesFilter({
  onChange,
  value,
}: {
  onChange: (value: null | string) => void;
  value: null | string;
}) {
  const t = useTranslations("characters.catalog.filters");
  const tCommon = useTranslations("common");
  const series = useSeriesPickerOptions("");
  const options = (series.data?.pages ?? []).flatMap((page) => page.items);

  return (
    <Select onValueChange={onChange} value={value ?? ""}>
      <SelectTrigger
        className="w-full data-[size=default]:h-10"
        clearLabel={tCommon("clear")}
        isClearable={value !== null}
        onClear={() => onChange(null)}
      >
        <SelectValue placeholder={t("anySeries")} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
