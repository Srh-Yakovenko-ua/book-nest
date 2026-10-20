"use client";

import type { CharacterCatalogItemView, Nullable } from "@app/shared";

import { useFormatter, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { CharacterCard, CharacterCardChip } from "@/components/ui/character-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSpeciesLabel } from "@/features/species";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type { CharactersCatalogState } from "../model/characters-catalog-query";

import { useToggleCatalogCharacterFavorite } from "../api/use-toggle-catalog-character-favorite";
import {
  CHARACTER_GLOBAL_VIEW,
  getCharacterDetailsPath,
  getCharacterEditPath,
} from "../model/character-routes";
import { useDeleteCharacterWithUndo } from "../model/use-delete-character-with-undo";
import { CatalogCharacterBooks } from "./catalog-character-books";
import { DeleteCharacterDialog } from "./delete-character-dialog";

const CATALOG_CARD = {
  descriptionLines: 2,
  visibleTags: 2,
} as const;

type CatalogCharacterCardProps = {
  character: CharacterCatalogItemView;
  view: CharactersCatalogState["view"];
};

export function CatalogCharacterCard({ character, view }: CatalogCharacterCardProps) {
  const t = useTranslations("characters.card");
  const tPage = useTranslations("characters.page");
  const speciesLabel = useSpeciesLabel();
  const toggleFavorite = useToggleCatalogCharacterFavorite();
  const deleteCharacter = useDeleteCharacterWithUndo();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const focusAfterDeleteRef = useRef<Nullable<HTMLElement>>(null);

  const isGrid = view === "grid";
  const species = speciesLabel(character.species);
  const description = character.neutralDescription?.trim() ?? "";
  const tagNames = character.tags.map((tag) => tag.name);
  const shownTags = tagNames.slice(0, CATALOG_CARD.visibleTags);
  const hiddenTags = tagNames.slice(CATALOG_CARD.visibleTags);

  function onToggleFavorite() {
    if (toggleFavorite.isPending) return;
    toggleFavorite.mutate({ characterId: character.id, isFavorite: !character.isFavorite });
  }

  function confirmDelete() {
    deleteCharacter.deleteWithUndo(character.id, () => {
      focusAfterDeleteRef.current = neighborCardLink(cardRef.current);
      setDeleteOpen(false);
    });
  }

  function restoreFocusAfterDialog(event: Event) {
    const target = focusAfterDeleteRef.current ?? menuTriggerRef.current;
    if (target === null || !target.isConnected) return;
    event.preventDefault();
    target.focus();
  }

  return (
    <>
      <CharacterCard
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
                  ref={menuTriggerRef}
                  size="icon-sm"
                  variant="ghost"
                >
                  <UiIcon name="more" size={18} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem asChild>
                  <Link
                    href={getCharacterEditPath({
                      characterId: character.id,
                      view: CHARACTER_GLOBAL_VIEW,
                    })}
                  >
                    <UiIcon name="edit" size={16} />
                    {t("edit")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setDeleteOpen(true)} variant="destructive">
                  <UiIcon name="trash" size={16} />
                  {tPage("deleteAction")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
        avatar={
          character.avatar === null
            ? undefined
            : { alt: character.name, src: character.avatar.urls.thumb }
        }
        className="w-full"
        density="compact"
        description={isGrid && description.length > 0 ? description : undefined}
        descriptionLines={CATALOG_CARD.descriptionLines}
        footer={<CatalogCharacterBooks character={character} />}
        href={getCharacterDetailsPath({ characterId: character.id })}
        linkComponent={Link}
        meta={isGrid && hiddenTags.length > 0 ? <HiddenTagsChip names={hiddenTags} /> : undefined}
        name={character.name}
        ref={cardRef}
        subtitle={species ?? undefined}
        traits={isGrid ? shownTags : undefined}
      />

      <DeleteCharacterDialog
        characterId={character.id}
        isDeleting={deleteCharacter.isPending}
        onCloseAutoFocus={restoreFocusAfterDialog}
        onConfirm={confirmDelete}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
      />
    </>
  );
}

function HiddenTagsChip({ names }: { names: string[] }) {
  const t = useTranslations("characters.catalog.tags");
  const format = useFormatter();
  const list = format.list(names, { type: "conjunction" });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className="relative z-10 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          type="button"
        >
          <CharacterCardChip>
            <span aria-hidden>+{names.length}</span>
            <span className="sr-only">{t("more", { count: names.length, names: list })}</span>
          </CharacterCardChip>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-80 break-words">{list}</TooltipContent>
    </Tooltip>
  );
}

function neighborCardLink(card: Nullable<HTMLElement>): Nullable<HTMLElement> {
  const item = card?.closest("li");
  const neighbor = item?.nextElementSibling ?? item?.previousElementSibling;
  return neighbor?.querySelector<HTMLElement>("h3 a") ?? null;
}
