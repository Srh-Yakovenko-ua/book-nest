"use client";

import type { CharacterSummaryView } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import {
  CharacterCardChip,
  CharacterCard as CharacterCardPrimitive,
} from "@/components/ui/character-card";
import { Link } from "@/i18n/navigation";

import {
  BOOK_CHARACTER_IMPORTANCE,
  explicitImportance,
  explicitStatus,
} from "../model/character-options";
import { getCharacterDetailsPath } from "../model/character-routes";
import { rosterDisplayName, rosterDistinctGlobalName } from "../model/characters-roster-query";

type CharacterSummaryCardProps = {
  character: CharacterSummaryView;
};

export function CharacterSummaryCard({ character }: CharacterSummaryCardProps) {
  const t = useTranslations("characters.card");
  const tImportance = useTranslations("characters.importance");
  const tStatus = useTranslations("characters.status");

  const name = rosterDisplayName(character);
  const media = character.portrait ?? character.avatar;
  const importance = explicitImportance(character.importance);
  const status = explicitStatus(character.status);
  const hiddenCount = character.hiddenFields.length;
  const hasMetadata = character.isPovCharacter || hiddenCount > 0;

  return (
    <CharacterCardPrimitive
      avatar={media === null ? undefined : { alt: name, src: media.urls.card }}
      className="w-full"
      density="compact"
      footer={
        status === null ? undefined : (
          <div className="flex justify-end">
            <CharacterCardChip className="max-w-1/2 shrink-0">{tStatus(status)}</CharacterCardChip>
          </div>
        )
      }
      href={getCharacterDetailsPath({ characterId: character.characterId })}
      linkComponent={Link}
      meta={
        hasMetadata ? (
          <>
            {character.isPovCharacter ? <CharacterCardChip>{t("pov")}</CharacterCardChip> : null}
            {hiddenCount > 0 ? (
              <Badge variant="warning">
                <UiIcon name="lock" size={12} />
                <span aria-hidden>{hiddenCount}</span>
                <span className="sr-only">{t("hiddenFields", { count: hiddenCount })}</span>
              </Badge>
            ) : null}
          </>
        ) : undefined
      }
      name={name}
      role={
        importance === null
          ? undefined
          : {
              label: tImportance(importance),
              variant: BOOK_CHARACTER_IMPORTANCE.badgeVariant[importance],
            }
      }
      secondaryName={rosterDistinctGlobalName(character)}
    />
  );
}
