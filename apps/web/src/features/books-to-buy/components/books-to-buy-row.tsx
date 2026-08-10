"use client";

import type { WishlistBookView } from "@app/shared";

import { MAX_STORE_LINKS_PER_BOOK } from "@app/shared";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import type { LibraryBook } from "@/features/books";

import { UiIcon } from "@/components/icons";
import { BookCard } from "@/components/ui/book-card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BookRow, useToggleFavorite } from "@/features/books";
import { Link } from "@/i18n/navigation";

import type { WishlistViewMode } from "../model/books-to-buy-derive";

import { StoreLinkDialog } from "./store-link-dialog";
import { StoreLinkManageDialog } from "./store-link-manage-dialog";
import { StoreLinksSummary } from "./store-links-summary";
import { WishlistStatusDialog } from "./wishlist-status-dialog";

export function BooksToBuyRow({
  book,
  libraryBook,
  view = "grid",
}: {
  book: WishlistBookView;
  libraryBook?: LibraryBook;
  view?: WishlistViewMode;
}) {
  const t = useTranslations("booksToBuy");
  const tLibrary = useTranslations("books.library");
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const favorite = useToggleFavorite();
  const isFavorite = favorite.isError
    ? book.isFavorite
    : (favorite.variables?.isFavorite ?? book.isFavorite);
  const canAddLink = book.storeLinks.length < MAX_STORE_LINKS_PER_BOOK;
  const hasStoreLinks = book.storeLinks.length > 0;
  const series =
    book.series === null
      ? undefined
      : {
          href: `/series/${book.series.id}`,
          name: book.series.name,
          positionLabel:
            book.partNumber === null
              ? undefined
              : t("card.seriesPosition", { position: book.partNumber }),
        };

  function toggleFavorite() {
    const nextIsFavorite = !isFavorite;
    favorite.mutate(
      { id: book.id, isFavorite: nextIsFavorite },
      {
        onError: () => toast.error(tLibrary("toast.error")),
        onSuccess: () =>
          toast.success(
            nextIsFavorite ? tLibrary("toast.favoriteAdded") : tLibrary("toast.favoriteRemoved"),
          ),
      },
    );
  }

  const favoriteLabel = isFavorite ? tLibrary("actions.unfavorite") : tLibrary("actions.favorite");
  const cardActions = (
    <div className="flex items-center gap-0.5">
      <Button
        aria-label={favoriteLabel}
        aria-pressed={isFavorite}
        className={`size-8 rounded-lg border backdrop-blur-md transition-all duration-[180ms] ease-out max-sm:size-6 ${
          isFavorite
            ? "border-brand bg-brand text-white shadow-btn hover:border-primary-hover hover:bg-primary-hover hover:text-white dark:hover:bg-primary-hover [&_svg]:animate-[heart-pop_320ms_ease]"
            : "border-[color:var(--book-overlay-pill-border)] bg-[var(--book-overlay-pill-surface)] text-[color:var(--book-overlay-pill-foreground)] shadow-[var(--book-overlay-pill-shadow)] hover:border-brand hover:text-brand"
        }`}
        onClick={toggleFavorite}
        size="icon-sm"
        title={favoriteLabel}
        variant="ghost"
      >
        <UiIcon className="max-sm:size-4" name={isFavorite ? "heart-fill" : "heart"} size={18} />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={t("rowMenuLabel", { title: book.title })}
            className="size-8 rounded-lg border border-[color:var(--book-overlay-pill-border)] bg-[var(--book-overlay-pill-surface)] text-[color:var(--book-overlay-pill-foreground)] shadow-[var(--book-overlay-pill-shadow)] backdrop-blur-md transition-all duration-[180ms] ease-out hover:border-brand hover:text-brand max-sm:size-6"
            size="icon-sm"
            variant="ghost"
          >
            <UiIcon className="max-sm:size-4" name="more" size={18} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => setStatusOpen(true)}>
            <UiIcon name="check-circle" size={14} />
            {t("statusDialog.trigger")}
          </DropdownMenuItem>
          {hasStoreLinks || canAddLink ? <DropdownMenuSeparator /> : null}
          {hasStoreLinks ? (
            <DropdownMenuItem onSelect={() => setManageOpen(true)}>
              <UiIcon name="store" size={14} />
              {t("storeLinks.manageWithCount", { count: book.storeLinks.length })}
            </DropdownMenuItem>
          ) : null}
          {canAddLink ? (
            <DropdownMenuItem onSelect={() => setAddLinkOpen(true)}>
              <UiIcon name="plus" size={14} />
              {t("storeLinks.add")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
  const storeSummary = (
    <StoreLinksSummary
      bestOffer={book.bestOffer}
      className="w-full max-w-sm min-w-0"
      onManage={() => setManageOpen(true)}
      storeLinks={book.storeLinks}
    />
  );
  const listBook =
    libraryBook === undefined
      ? undefined
      : {
          ...libraryBook,
          genres: undefined,
          isInReadingQueue: undefined,
          ownership: undefined,
          progress: undefined,
          rating: undefined,
          ratingLabel: undefined,
          tags: undefined,
        };
  const card =
    view === "list" && listBook !== undefined ? (
      <BookRow
        actionsSlot={storeSummary}
        book={listBook}
        kebab={cardActions}
        linkComponent={Link}
        mobileCompact
        statusPlacement="note"
      />
    ) : (
      <BookCard
        authors={book.authors.map((author) => author.name)}
        cover={book.cover ? { alt: book.title, src: book.cover.urls.card } : undefined}
        footer={storeSummary}
        href={`/books/${book.id}`}
        kebab={cardActions}
        linkComponent={Link}
        mobileCompact
        publisher={book.publisher?.name}
        series={series}
        title={book.title}
      />
    );

  return (
    <>
      {card}
      <WishlistStatusDialog book={book} onOpenChange={setStatusOpen} open={statusOpen} />
      <StoreLinkDialog book={book} mode="create" onOpenChange={setAddLinkOpen} open={addLinkOpen} />
      <StoreLinkManageDialog book={book} onOpenChange={setManageOpen} open={manageOpen} />
    </>
  );
}
