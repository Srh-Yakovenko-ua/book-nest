"use client";

import type { CharacterCatalogItemView, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";

import { useCharacterBooks } from "../api/use-character-books";
import { CharacterBooksList } from "./character-books-list";

type BooksSurface = "drawer" | "popover";

const BOOKS_POPOVER = {
  collisionPadding: 16,
} as const;

type CharacterBooksOverlayProps = {
  character: Pick<CharacterCatalogItemView, "appearanceCount" | "id" | "name">;
  hiddenCount: number;
};

export function CharacterBooksOverlay({ character, hiddenCount }: CharacterBooksOverlayProps) {
  const t = useTranslations("characters.catalog.books");
  const surface: BooksSurface = useIsMobile() ? "drawer" : "popover";
  const [openSurface, setOpenSurface] = useState<Nullable<BooksSurface>>(null);
  const titleId = useId();
  const isOpen = openSurface === surface;
  const query = useCharacterBooks({ characterId: character.id, enabled: isOpen });

  if (openSurface !== null && openSurface !== surface) setOpenSurface(null);

  function onOpenChange(open: boolean) {
    setOpenSurface(open ? surface : null);
  }

  const trigger = (
    <button
      aria-label={t("more", { count: hiddenCount })}
      className="group block cursor-pointer rounded-md px-1.5 py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      type="button"
    >
      <span
        aria-hidden
        className="grid aspect-3/4 w-8 place-items-center rounded-sm border border-border bg-secondary text-xs font-semibold text-foreground transition-colors group-hover:border-accent-border group-hover:text-brand motion-reduce:transition-none"
      >
        +{hiddenCount}
      </span>
    </button>
  );

  if (surface === "drawer") {
    return (
      <Drawer autoFocus onOpenChange={onOpenChange} open={isOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent aria-describedby={undefined}>
          {isOpen ? (
            <CharacterBooksList
              character={character}
              query={query}
              title={<DrawerTitle>{t("title")}</DrawerTitle>}
            />
          ) : null}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover onOpenChange={onOpenChange} open={isOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        aria-labelledby={titleId}
        className="max-h-(--radix-popover-content-available-height) w-90 max-w-(--radix-popover-content-available-width) gap-0 overflow-hidden p-0"
        collisionPadding={BOOKS_POPOVER.collisionPadding}
      >
        {isOpen ? (
          <CharacterBooksList
            character={character}
            query={query}
            title={
              <PopoverTitle className="text-base text-ink" id={titleId}>
                {t("title")}
              </PopoverTitle>
            }
          />
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
