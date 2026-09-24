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
import { getCharacterDetailsPath } from "../model/character-routes";
import { rosterDisplayName } from "../model/characters-roster-query";

type CharacterCardProps = {
  bookId: string;
  character: CharacterSummaryView;
  onEdit: () => void;
  onUnlink: () => void;
};

export function CharacterCard({ bookId, character, onEdit, onUnlink }: CharacterCardProps) {
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
    <div className="group relative flex w-full">
      <CharacterCardPrimitive
        actions={
          <div className="relative z-20 flex items-center gap-0.5">
            {hiddenCount > 0 ? (
              <Badge
                aria-label={t("hiddenFields", { count: hiddenCount })}
                className="mr-0.5"
                variant="warning"
              >
                <UiIcon name="lock" size={12} />
                {hiddenCount}
              </Badge>
            ) : null}

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
                <DropdownMenuItem onSelect={onEdit}>
                  <UiIcon name="edit" size={16} />
                  {t("edit")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onUnlink}>
                  <UiIcon name="link" size={16} />
                  {t("unlink")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
        avatar={media === null ? undefined : { alt: name, src: media.urls.card }}
        className="w-full group-hover:-translate-y-0.5 group-hover:shadow-hover"
        name={name}
        role={
          importance === null
            ? undefined
            : {
                label: tImportance(importance),
                variant: BOOK_CHARACTER_IMPORTANCE.badgeVariant[importance],
              }
        }
        traits={traits.length === 0 ? undefined : traits}
      />

      <Link
        aria-label={t("openDetails", { name })}
        className="absolute inset-0 z-10 cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        href={getCharacterDetailsPath({ bookId, characterId: character.characterId })}
      />
    </div>
  );
}
