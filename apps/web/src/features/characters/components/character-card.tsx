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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { useUpdateCharacter } from "../api/use-update-character";
import { IMPORTANCE_BADGE_VARIANT } from "../model/character-options";

type CharacterCardProps = {
  character: CharacterSummaryView;
  onDelete: () => void;
  onEdit: () => void;
  onOpenDetails: () => void;
  onUnlink: () => void;
};

export function CharacterCard({
  character,
  onDelete,
  onEdit,
  onOpenDetails,
  onUnlink,
}: CharacterCardProps) {
  const t = useTranslations("characters.card");
  const tImportance = useTranslations("characters.importance");
  const tStatus = useTranslations("characters.status");
  const updateCharacter = useUpdateCharacter();

  const name = character.displayName ?? character.name;
  const media = character.portrait ?? character.avatar;
  const statusLabel = character.status === null ? undefined : tStatus(character.status);
  const hiddenCount = character.hiddenFields.length;

  function onToggleFavorite() {
    updateCharacter.mutate({
      characterId: character.characterId,
      input: { isFavorite: !character.isFavorite },
    });
  }

  return (
    <CharacterCardPrimitive
      actions={
        <>
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
            disabled={updateCharacter.isPending}
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
              <DropdownMenuItem onSelect={onOpenDetails}>
                <UiIcon name="eye" size={16} />
                {t("details")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onEdit}>
                <UiIcon name="edit" size={16} />
                {t("edit")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onUnlink}>
                <UiIcon name="link" size={16} />
                {t("unlink")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onDelete} variant="destructive">
                <UiIcon name="trash" size={16} />
                {t("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
      avatar={media === null ? undefined : { alt: name, src: media.urls.card }}
      name={name}
      role={{
        label: tImportance(character.importance),
        variant: IMPORTANCE_BADGE_VARIANT[character.importance],
      }}
      traits={statusLabel === undefined ? undefined : [statusLabel]}
    />
  );
}
