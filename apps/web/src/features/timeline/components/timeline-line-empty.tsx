import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

type TimelineLineEmptyProps = {
  onAddEvent: () => void;
  onPickAllLines: () => void;
};

export function TimelineLineEmpty({ onAddEvent, onPickAllLines }: TimelineLineEmptyProps) {
  const t = useTranslations("timeline.states");

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-accent text-icon">
        <UiIcon name="layers" size={22} />
      </span>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        {t("lineEmptyTitle")}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={onAddEvent} size="sm">
          <UiIcon name="plus" size={16} />
          {t("lineEmptyAddAction")}
        </Button>
        <Button onClick={onPickAllLines} size="sm" variant="secondary">
          {t("lineEmptyPickAction")}
        </Button>
      </div>
    </div>
  );
}
