"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

type CharacterSpoilerFieldProps = {
  children: ReactNode;
  hidden: boolean;
  label: string;
  onReveal?: () => void;
  revealing?: boolean;
};

export function CharacterSpoilerField({
  children,
  hidden,
  label,
  onReveal,
  revealing = false,
}: CharacterSpoilerFieldProps) {
  const t = useTranslations("characters.spoiler");

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      {hidden ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-secondary/50 px-3 py-2.5">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <UiIcon name="lock" size={16} />
            {t("hidden")}
          </span>
          {onReveal === undefined ? null : (
            <Button
              aria-label={t("revealAria", { field: label })}
              disabled={revealing}
              loading={revealing}
              onClick={onReveal}
              size="sm"
              variant="secondary"
            >
              <UiIcon name="eye" size={14} />
              {t("reveal")}
            </Button>
          )}
        </div>
      ) : (
        <div className="text-sm leading-relaxed text-foreground">{children}</div>
      )}
    </div>
  );
}
