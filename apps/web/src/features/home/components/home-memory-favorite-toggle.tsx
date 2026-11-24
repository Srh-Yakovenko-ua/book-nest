"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

type HomeMemoryFavoriteToggleProps = {
  isFavorite: boolean;
  isPending: boolean;
  onToggle: () => void;
};

export function HomeMemoryFavoriteToggle({
  isFavorite,
  isPending,
  onToggle,
}: HomeMemoryFavoriteToggleProps) {
  const t = useTranslations("home.memory");

  return (
    <Button
      aria-disabled={isPending}
      aria-label={t("favorite")}
      aria-pressed={isFavorite}
      className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      onClick={() => {
        if (isPending) return;
        onToggle();
      }}
      size="icon-sm"
      variant="ghost"
    >
      <UiIcon
        aria-hidden
        className={isFavorite ? "text-favorite" : "text-muted-foreground"}
        name={isFavorite ? "heart-fill" : "heart"}
        size={16}
      />
    </Button>
  );
}
