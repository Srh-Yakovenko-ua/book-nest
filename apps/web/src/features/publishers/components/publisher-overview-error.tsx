import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

type PublisherOverviewErrorProps = {
  onRetry: () => void;
};

export function PublisherOverviewError({ onRetry }: PublisherOverviewErrorProps) {
  const t = useTranslations("publishers.details.overview.error");

  return (
    <div
      className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-4 py-8 text-center"
      role="alert"
    >
      <p className="text-sm text-muted-foreground">{t("title")}</p>
      <Button onClick={onRetry} size="sm" variant="outline">
        {t("retry")}
      </Button>
    </div>
  );
}
