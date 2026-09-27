import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import type { TimelineFilteredEmptyKind } from "../model/timeline-empty-state";

type FilteredEmptyMeta = {
  actionKey: Nullable<string>;
  icon: UiIconName;
  textKey: string;
};

type TimelineFilteredEmptyProps = {
  onAction: () => void;
  state: TimelineFilteredEmptyKind;
};

const FILTERED_EMPTY_META = {
  filters: { actionKey: "filteredEmptyAction", icon: "filter", textKey: "filteredEmptyTitle" },
  recap: { actionKey: "recapEmptyAction", icon: "clock", textKey: "recapEmptyText" },
  search: { actionKey: "searchEmptyAction", icon: "search", textKey: "searchEmptyText" },
  withoutChapter: {
    actionKey: null,
    icon: "check-circle",
    textKey: "withoutChapterEmptyText",
  },
} as const satisfies Record<TimelineFilteredEmptyKind, FilteredEmptyMeta>;

export function TimelineFilteredEmpty({ onAction, state }: TimelineFilteredEmptyProps) {
  const t = useTranslations("timeline.states");
  const meta = FILTERED_EMPTY_META[state];

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-accent text-icon">
        <UiIcon name={meta.icon} size={22} />
      </span>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{t(meta.textKey)}</p>
      {meta.actionKey === null ? null : (
        <Button onClick={onAction} size="sm" variant="secondary">
          {t(meta.actionKey)}
        </Button>
      )}
    </div>
  );
}
