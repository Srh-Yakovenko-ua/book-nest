"use client";

import { useTranslations } from "next-intl";

import { SpoilerGate } from "@/components/spoiler-gate";
import { Button } from "@/components/ui/button";

export function HomeMemorySpoiler({ onReveal }: { onReveal: () => void }) {
  const t = useTranslations("home.memory.spoiler");

  return (
    <SpoilerGate
      action={
        <Button onClick={onReveal} size="sm" variant="secondary">
          {t("reveal")}
        </Button>
      }
      description={t("description")}
      title={t("title")}
      variant="compact"
    />
  );
}
