"use client";

import { TIMELINE_EVENT_TYPES, TIMELINE_IMPORTANCE_LEVELS } from "@app/shared";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterSection } from "@/components/ui/filter-panel";
import { Label } from "@/components/ui/label";
import { Multiselect } from "@/components/ui/multiselect";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";

import type { ImportancePreset } from "../model/importance-preset";
import type { TimelineEventsFilterState } from "../model/timeline-events-query";

import { detectImportancePreset, importancePresetValues } from "../model/importance-preset";

const IMPORTANCE_PRESETS: readonly ImportancePreset[] = ["importantEvents", "keyOnly"];

type TimelineFiltersProps = {
  filters: TimelineEventsFilterState;
  onChange: (filters: TimelineEventsFilterState) => void;
};

export function TimelineFilters({ filters, onChange }: TimelineFiltersProps) {
  const t = useTranslations("timeline.filters");
  const tType = useTranslations("timeline.eventType");
  const tImportance = useTranslations("timeline.importance");
  const tPreset = useTranslations("timeline.preset");
  const [open, setOpen] = useState(false);

  const activePreset = detectImportancePreset(filters.importance);
  const activeCount =
    (filters.eventType.length > 0 ? 1 : 0) +
    (filters.importance.length > 0 ? 1 : 0) +
    (filters.unresolved ? 1 : 0);

  const typeOptions = TIMELINE_EVENT_TYPES.map((type) => ({ label: tType(type), value: type }));
  const importanceOptions = TIMELINE_IMPORTANCE_LEVELS.map((level) => ({
    label: tImportance(level),
    value: level,
  }));

  function setEventType(next: string[]) {
    onChange({ ...filters, eventType: TIMELINE_EVENT_TYPES.filter((type) => next.includes(type)) });
  }

  function setImportance(next: string[]) {
    onChange({
      ...filters,
      importance: TIMELINE_IMPORTANCE_LEVELS.filter((level) => next.includes(level)),
    });
  }

  function applyPreset(preset: ImportancePreset) {
    const values = activePreset === preset ? [] : [...importancePresetValues(preset)];
    onChange({ ...filters, importance: values });
  }

  function clearFacets() {
    onChange({ ...filters, eventType: [], importance: [], unresolved: false });
  }

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>
        <Button className="h-10" type="button" variant="secondary">
          <UiIcon name="funnel" size={16} />
          {t("title")}
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
          <FilterSection title={t("typeLabel")}>
            <Multiselect
              emptyText={t("noOptions")}
              onValueChange={setEventType}
              options={typeOptions}
              placeholder={t("selectPlaceholder")}
              searchPlaceholder={t("searchOptions")}
              value={filters.eventType}
            />
          </FilterSection>

          <FilterSection title={t("importanceLabel")}>
            <div className="flex flex-wrap gap-2">
              {IMPORTANCE_PRESETS.map((preset) => {
                const active = activePreset === preset;
                return (
                  <Button
                    aria-pressed={active}
                    key={preset}
                    onClick={() => applyPreset(preset)}
                    size="sm"
                    type="button"
                    variant={active ? "default" : "secondary"}
                  >
                    {tPreset(preset)}
                  </Button>
                );
              })}
            </div>
            <Multiselect
              emptyText={t("noOptions")}
              onValueChange={setImportance}
              options={importanceOptions}
              placeholder={t("selectPlaceholder")}
              searchPlaceholder={t("searchOptions")}
              value={filters.importance}
            />
          </FilterSection>

          <FilterSection title={t("statusLabel")}>
            <Label className="justify-between">
              {t("unresolved")}
              <Switch
                checked={filters.unresolved}
                onCheckedChange={(checked) => onChange({ ...filters, unresolved: checked })}
              />
            </Label>
          </FilterSection>
        </div>

        <SheetFooter>
          <Button disabled={activeCount === 0} onClick={clearFacets} type="button" variant="ghost">
            {t("reset")}
          </Button>
          <Button onClick={() => setOpen(false)} type="button">
            {t("done")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
