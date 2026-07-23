import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

type TimelineFilteredEmptyProps = {
  onReset: () => void;
};

export function TimelineFilteredEmpty({ onReset }: TimelineFilteredEmptyProps) {
  const t = useTranslations("timeline.states");

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-accent text-icon">
        <UiIcon name="filter" size={22} />
      </span>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        {t("filteredEmptyTitle")}
      </p>
      <Button onClick={onReset} size="sm" variant="secondary">
        {t("filteredEmptyAction")}
      </Button>
    </div>
  );
}
