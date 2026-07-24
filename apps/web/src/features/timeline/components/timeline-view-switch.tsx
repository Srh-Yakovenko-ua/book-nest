import { useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import type { TimelineViewMode } from "../model/timeline-view-mode";

import { TIMELINE_VIEW_MODES } from "../model/timeline-view-mode";

const VIEW_ICON = {
  list: "list",
  overview: "chart",
  stream: "sessions",
} as const satisfies Record<TimelineViewMode, UiIconName>;

type TimelineViewSwitchProps = {
  onChange: (mode: TimelineViewMode) => void;
  value: TimelineViewMode;
};

export function TimelineViewSwitch({ onChange, value }: TimelineViewSwitchProps) {
  const t = useTranslations("timeline");

  return (
    <div
      aria-label={t("viewLabel")}
      className="inline-flex items-center gap-1 rounded-lg border border-border bg-background p-1"
      role="group"
    >
      {TIMELINE_VIEW_MODES.map((mode) => {
        const active = mode === value;
        return (
          <button
            aria-pressed={active}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors",
              active
                ? "bg-brand/10 font-medium text-brand"
                : "text-muted-foreground hover:text-foreground",
            )}
            key={mode}
            onClick={() => onChange(mode)}
            type="button"
          >
            <UiIcon name={VIEW_ICON[mode]} size={15} />
            {t(`view.${mode}`)}
          </button>
        );
      })}
    </div>
  );
}
