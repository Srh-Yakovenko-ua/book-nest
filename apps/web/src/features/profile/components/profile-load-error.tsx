"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

export function ProfileLoadError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("profile.loadError");

  return (
    <div className="flex flex-col items-center gap-3 px-4 py-6 text-center" role="alert">
      <UiIcon className="text-muted-foreground" name="alert-circle" size={22} />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{t("title")}</p>
        <p className="text-xs text-muted-foreground">{t("description")}</p>
      </div>
      <Button onClick={onRetry} size="sm" type="button" variant="secondary">
        <UiIcon name="refresh" size={14} />
        {t("retry")}
      </Button>
    </div>
  );
}
