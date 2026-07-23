import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

type TimelineEmptyProps = {
  onAddEvent: () => void;
};

export function TimelineEmpty({ onAddEvent }: TimelineEmptyProps) {
  const t = useTranslations("timeline.states");

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-accent text-icon">
        <UiIcon name="calendar" size={22} />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-heading text-sm font-semibold text-ink">{t("emptyTitle")}</p>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{t("emptyText")}</p>
      </div>
      <Button onClick={onAddEvent} size="sm">
        <UiIcon name="plus" size={16} />
        {t("emptyAction")}
      </Button>
    </div>
  );
}
