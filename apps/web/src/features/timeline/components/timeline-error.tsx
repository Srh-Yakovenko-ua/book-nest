import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

type TimelineErrorProps = {
  onRetry: () => void;
};

export function TimelineError({ onRetry }: TimelineErrorProps) {
  const t = useTranslations("timeline.states");

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-8 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-destructive/10 text-destructive">
        <UiIcon name="alert-circle" size={22} />
      </span>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{t("errorText")}</p>
      <Button onClick={onRetry} size="sm" variant="secondary">
        <UiIcon name="refresh" size={14} />
        {t("retry")}
      </Button>
    </div>
  );
}
