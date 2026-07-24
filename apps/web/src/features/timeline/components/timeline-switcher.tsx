import type { Nullable, TimelineView } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { markerClass } from "../model/color-key";

type SwitcherChipProps = {
  active: boolean;
  colorKey?: Nullable<TimelineView["colorKey"]>;
  count: number;
  label: string;
  onSelect: () => void;
  showCount: boolean;
};

type TimelineSwitcherProps = {
  activeTimelineId: Nullable<string>;
  onCreateLine: () => void;
  onEditLine: (timeline: TimelineView) => void;
  onManageLines: () => void;
  onSelect: (timelineId: Nullable<string>) => void;
  timelines: TimelineView[];
  totalEvents: number;
};

export function TimelineSwitcher({
  activeTimelineId,
  onCreateLine,
  onEditLine,
  onManageLines,
  onSelect,
  timelines,
  totalEvents,
}: TimelineSwitcherProps) {
  const t = useTranslations("timeline");
  const tManage = useTranslations("timeline.manage");

  if (timelines.length <= 1) {
    const line = timelines[0];
    return (
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span
            aria-hidden
            className={cn("size-2 rounded-full", markerClass(line?.colorKey ?? null))}
          />
          {line?.name ?? t("mainLine")}
        </div>
        <div className="ml-auto flex items-center gap-1">
          {line === undefined ? null : (
            <Button onClick={() => onEditLine(line)} size="sm" variant="ghost">
              <UiIcon name="edit" size={16} />
              {tManage("edit")}
            </Button>
          )}
          <Button onClick={onCreateLine} size="sm" variant="ghost">
            <UiIcon name="plus" size={16} />
            {t("newLine")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div aria-label={t("manageLines")} className="flex flex-wrap gap-2" role="group">
        <SwitcherChip
          active={activeTimelineId === null}
          count={totalEvents}
          label={t("allLines", { count: totalEvents })}
          onSelect={() => onSelect(null)}
          showCount={false}
        />
        {timelines.map((line) => (
          <SwitcherChip
            active={activeTimelineId === line.id}
            colorKey={line.colorKey}
            count={line.eventsCount}
            key={line.id}
            label={line.name}
            onSelect={() => onSelect(line.id)}
            showCount
          />
        ))}
      </div>
      <div className="ml-auto flex items-center gap-1">
        <Button onClick={onManageLines} size="sm" variant="ghost">
          <UiIcon name="layers" size={16} />
          {t("manageLines")}
        </Button>
        <Button onClick={onCreateLine} size="sm" variant="ghost">
          <UiIcon name="plus" size={16} />
          {t("newLine")}
        </Button>
      </div>
    </div>
  );
}

function SwitcherChip({ active, colorKey, count, label, onSelect, showCount }: SwitcherChipProps) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
        active
          ? "border-brand/40 bg-brand/10 font-medium text-brand"
          : "border-border bg-background text-muted-foreground hover:text-foreground",
      )}
      onClick={onSelect}
      type="button"
    >
      {colorKey === undefined ? null : (
        <span aria-hidden className={cn("size-2 rounded-full", markerClass(colorKey))} />
      )}
      <span className="truncate">{label}</span>
      {showCount ? <span className="tabular-nums opacity-70">{count}</span> : null}
    </button>
  );
}
