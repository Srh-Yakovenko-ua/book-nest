"use client";

import type { BookCharacterRoleView, BookCharacterRosterItem, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CharacterCardChip,
  CharacterCard as CharacterCardPrimitive,
} from "@/components/ui/character-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSpeciesLabel } from "@/features/species";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { useToggleCharacterFavorite } from "../api/use-toggle-character-favorite";
import {
  BOOK_CHARACTER_IMPORTANCE,
  BOOK_CHARACTER_ROLE,
  BOOK_CHARACTER_STATUS,
  explicitImportance,
  explicitStatus,
} from "../model/character-options";
import { getCharacterDetailsPath, getCharacterEditPath } from "../model/character-routes";
import { rosterDisplayName, rosterDistinctGlobalName } from "../model/characters-roster-query";

const ROSTER_CARD_VISIBLE_ROLES = 2;

type CharacterCardProps = {
  bookId: string;
  character: BookCharacterRosterItem;
  onUnlink: () => void;
};

export function CharacterCard({ bookId, character, onUnlink }: CharacterCardProps) {
  const t = useTranslations("characters.card");
  const tImportance = useTranslations("characters.importance");
  const tRole = useTranslations("characters.roleType");
  const tStatus = useTranslations("characters.status");
  const speciesLabel = useSpeciesLabel();
  const toggleFavorite = useToggleCharacterFavorite(bookId);

  const name = rosterDisplayName(character);
  const media = character.portrait ?? character.avatar;
  const importance = explicitImportance(character.importance);
  const shownRoles = character.roles.slice(0, ROSTER_CARD_VISIBLE_ROLES);
  const surplusRoleCount = character.roles.length - shownRoles.length;
  const hiddenCount = character.hiddenFields.length;
  const hasMetadata = shownRoles.length > 0 || character.isPovCharacter || hiddenCount > 0;
  const species = speciesLabel(character.species);
  const statusLabel = describeStatus();

  function describeStatus(): Nullable<string> {
    const status = explicitStatus(character.status);
    if (status === null) return null;
    if (status === BOOK_CHARACTER_STATUS.custom && character.statusCustomText !== null) {
      return character.statusCustomText;
    }
    return tStatus(status);
  }

  function roleLabel(role: BookCharacterRoleView): string {
    return role.roleType === BOOK_CHARACTER_ROLE.custom && role.customRole !== null
      ? role.customRole
      : tRole(role.roleType);
  }

  function onToggleFavorite() {
    if (toggleFavorite.isPending) return;
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
      description={character.descriptionPreview ?? undefined}
      footer={
        species === null && statusLabel === null ? undefined : (
          <div className="flex min-w-0 items-center gap-2">
            {species === null ? null : (
              <span className="min-w-0 truncate text-[0.8125rem] text-muted-foreground">
                {species}
              </span>
            )}
            {statusLabel === null ? null : (
              <CharacterCardChip className="ml-auto max-w-1/2 shrink-0">
                {statusLabel}
              </CharacterCardChip>
            )}
          </div>
        )
      }
      href={getCharacterDetailsPath({ bookId, characterId: character.characterId })}
      linkComponent={Link}
      meta={
        hasMetadata ? (
          <>
            {shownRoles.map((role) => (
              <CharacterCardChip key={role.id}>{roleLabel(role)}</CharacterCardChip>
            ))}
            {surplusRoleCount > 0 ? (
              <CharacterCardChip>
                <span aria-hidden>+{surplusRoleCount}</span>
                <span className="sr-only">{t("moreRoles", { count: surplusRoleCount })}</span>
              </CharacterCardChip>
            ) : null}
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
