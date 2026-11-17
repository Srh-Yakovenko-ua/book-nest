"use client";

import type { CharacterCatalogItemView } from "@app/shared";

import { CHARACTER_CATALOG_BOOKS_PREVIEW_MAX } from "@app/shared";
import { useTranslations } from "next-intl";

import { TooltipHint } from "@/components/tooltip-hint";
import { Link } from "@/i18n/navigation";

import { CharacterBookCover } from "./character-book-cover";
import { CharacterBooksOverlay } from "./character-books-overlay";

type CatalogCharacterBooksProps = {
  character: CharacterCatalogItemView;
};

export function CatalogCharacterBooks({ character }: CatalogCharacterBooksProps) {
  const t = useTranslations("characters.catalog.books");
  const { appearanceCount, booksPreview } = character;
  const hiddenCount = appearanceCount - CHARACTER_CATALOG_BOOKS_PREVIEW_MAX;

  if (appearanceCount === 0) {
    return <p className="text-sm text-muted-foreground">{t("none")}</p>;
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <p className="text-sm text-muted-foreground">{t("count", { count: appearanceCount })}</p>

      <ul className="-my-1 -mr-1.5 flex items-center">
        {booksPreview.map((book) => (
          <li className="relative z-10" key={book.id}>
            <TooltipHint label={book.title}>
              <Link
                aria-label={book.title}
                className="block rounded-md px-1.5 py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                href={`/books/${book.id}`}
              >
                <CharacterBookCover className="w-8" cover={book.cover} />
              </Link>
            </TooltipHint>
          </li>
        ))}
        {hiddenCount > 0 ? (
          <li className="relative z-10">
            <CharacterBooksOverlay character={character} hiddenCount={hiddenCount} />
          </li>
        ) : null}
      </ul>
    </div>
  );
}
