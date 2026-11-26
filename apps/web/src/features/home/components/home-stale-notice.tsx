import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

type HomeStaleNoticeProps = {
  isRetrying: boolean;
  onRetry: () => void;
};

export function HomeStaleNotice({ isRetrying, onRetry }: HomeStaleNoticeProps) {
  const t = useTranslations("home.stale");

  return (
    <p
      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
      role="status"
    >
      <UiIcon aria-hidden className="shrink-0 text-warning" name="clock" size={14} />
      <span>{t("message")}</span>
      <Button
        className="h-auto px-1 py-0.5 text-xs"
        loading={isRetrying}
        onClick={onRetry}
        size="sm"
        variant="link"
      >
        {t("retry")}
      </Button>
    </p>
  );
}
