"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

type CharactersErrorStateProps = {
  onRetry: () => void;
};

export function CharactersErrorState({ onRetry }: CharactersErrorStateProps) {
  const t = useTranslations("characters.states");

  return (
    <div
      className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center"
      role="alert"
    >
      <span className="grid size-10 place-items-center rounded-full bg-error-soft text-error">
        <UiIcon name="alert-triangle" size={20} />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{t("errorTitle")}</p>
        <p className="text-xs text-muted-foreground">{t("errorDescription")}</p>
      </div>
      <Button onClick={onRetry} size="sm" variant="secondary">
        <UiIcon name="refresh" size={14} />
        {t("retry")}
      </Button>
    </div>
  );
}
