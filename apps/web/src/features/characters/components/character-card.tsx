"use client";

import type { CharacterSummaryView } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CharacterCard as CharacterCardPrimitive } from "@/components/ui/character-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { useToggleCharacterFavorite } from "../api/use-toggle-character-favorite";
import {
  BOOK_CHARACTER_IMPORTANCE,
  explicitImportance,
  explicitStatus,
} from "../model/character-options";
import { getCharacterDetailsPath, getCharacterEditPath } from "../model/character-routes";
import { rosterDisplayName, rosterDistinctGlobalName } from "../model/characters-roster-query";

type CharacterCardProps = {
  bookId: string;
  character: CharacterSummaryView;
  onUnlink: () => void;
};

export function CharacterCard({ bookId, character, onUnlink }: CharacterCardProps) {
  const t = useTranslations("characters.card");
  const tImportance = useTranslations("characters.importance");
  const tStatus = useTranslations("characters.status");
  const toggleFavorite = useToggleCharacterFavorite(bookId);

  const name = rosterDisplayName(character);
  const media = character.portrait ?? character.avatar;
  const importance = explicitImportance(character.importance);
  const status = explicitStatus(character.status);
  const hiddenCount = character.hiddenFields.length;
  const traits = [
    ...(character.isPovCharacter ? [t("pov")] : []),
    ...(status === null ? [] : [tStatus(status)]),
  ];

  function onToggleFavorite() {
    toggleFavorite.mutate({
      characterId: character.characterId,
      isFavorite: !character.isFavorite,
    });
  }

  return (
    <CharacterCardPrimitive
      actions={
        <>
          <Button
            aria-label={t(character.isFavorite ? "unfavorite" : "favorite")}
            aria-pressed={character.isFavorite}
            className={cn(
              "size-8 rounded-lg border",
              character.isFavorite
                ? "border-brand bg-brand text-primary-foreground hover:bg-primary-hover"
                : "border-border bg-card text-muted-foreground hover:border-brand hover:text-brand",
            )}
            onClick={onToggleFavorite}
            size="icon-sm"
            variant="ghost"
          >
            <UiIcon name={character.isFavorite ? "heart-fill" : "heart"} size={18} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={t("menu")}
                className="size-8 rounded-lg border border-border bg-card text-muted-foreground hover:border-brand hover:text-brand"
                size="icon-sm"
                variant="ghost"
              >
                <UiIcon name="more" size={18} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem asChild>
                <Link href={getCharacterEditPath({ bookId, characterId: character.characterId })}>
                  <UiIcon name="edit" size={16} />
                  {t("edit")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onUnlink}>
                <UiIcon name="link" size={16} />
                {t("unlink")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
      avatar={media === null ? undefined : { alt: name, src: media.urls.card }}
      className="w-full"
      density="compact"
      href={getCharacterDetailsPath({ bookId, characterId: character.characterId })}
      linkComponent={Link}
      meta={
        hiddenCount > 0 ? (
          <Badge variant="warning">
            <UiIcon name="lock" size={12} />
            <span aria-hidden>{hiddenCount}</span>
            <span className="sr-only">{t("hiddenFields", { count: hiddenCount })}</span>
          </Badge>
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
      traits={traits.length === 0 ? undefined : traits}
    />
  );
}
