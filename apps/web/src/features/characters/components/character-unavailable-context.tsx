"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { CHARACTER_GLOBAL_VIEW, getCharacterDetailsPath } from "../model/character-routes";

type CharacterUnavailableContextProps = {
  characterId: string;
};

export function CharacterUnavailableContext({ characterId }: CharacterUnavailableContextProps) {
  const t = useTranslations("characters.page");

  return (
    <div
      className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center"
      role="alert"
    >
      <span className="grid size-14 place-items-center rounded-full bg-accent text-icon">
        <UiIcon name="lock" size={24} />
      </span>
      <h1 className="font-heading text-2xl text-ink">{t("unavailableTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("unavailableDescription")}</p>
      <Button asChild variant="secondary">
        <Link href={getCharacterDetailsPath({ characterId, view: CHARACTER_GLOBAL_VIEW })}>
          {t("openGlobalProfile")}
        </Link>
      </Button>
    </div>
  );
}
