"use client";

import type { WishlistBookView } from "@app/shared";

import { MAX_STORE_LINKS_PER_BOOK } from "@app/shared";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";

import { StoreLinkDialog } from "./store-link-dialog";
import { StoreLinkManageDialog } from "./store-link-manage-dialog";
import { StoreLinksSummary } from "./store-links-summary";
import { WishlistStatusDialog } from "./wishlist-status-dialog";

export function BooksToBuyRow({ book }: { book: WishlistBookView }) {
  const t = useTranslations("booksToBuy");
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const authorNames = book.authors.map((author) => author.name).join(", ");
  const canAddLink = book.storeLinks.length < MAX_STORE_LINKS_PER_BOOK;
  const hasStoreLinks = book.storeLinks.length > 0;

  return (
    <>
      <div className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-card transition-[box-shadow,border-color] duration-200 ease-out hover:border-accent-border hover:shadow-hover motion-reduce:transition-none sm:flex-row sm:items-center sm:gap-4">
        <Link
          className="flex min-w-0 flex-1 items-center gap-3.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          href={`/books/${book.id}`}
        >
          <BooksToBuyCover alt={book.title} src={book.cover?.urls.thumb} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h3 className="truncate font-heading text-sm leading-tight font-bold text-ink transition-colors group-hover:text-primary">
              {book.title}
            </h3>
            <p className="truncate text-xs text-muted-foreground">{authorNames}</p>
          </div>
        </Link>
        <StoreLinksSummary
          bestOffer={book.bestOffer}
          className="sm:w-56 sm:shrink-0 md:w-64"
          onManage={() => setManageOpen(true)}
          storeLinks={book.storeLinks}
        />
        <div className="flex shrink-0 items-center gap-1.5 self-start sm:self-auto">
          <Button
            aria-label={t("statusDialog.triggerFor", { title: book.title })}
            onClick={() => setStatusOpen(true)}
            size="sm"
          >
            <UiIcon name="check-circle" size={16} />
            {t("statusDialog.trigger")}
          </Button>
          {hasStoreLinks || canAddLink ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label={t("rowMenuLabel", { title: book.title })}
                  size="icon-sm"
                  variant="ghost"
                >
                  <UiIcon name="more" size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
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
          ) : null}
        </div>
      </div>
      <WishlistStatusDialog book={book} onOpenChange={setStatusOpen} open={statusOpen} />
      <StoreLinkDialog book={book} mode="create" onOpenChange={setAddLinkOpen} open={addLinkOpen} />
      <StoreLinkManageDialog book={book} onOpenChange={setManageOpen} open={manageOpen} />
    </>
  );
}

function BooksToBuyCover({ alt, src }: { alt: string; src?: string }) {
  if (src === undefined) {
    return (
      <div className="grid aspect-[3/4] w-11 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground/70">
        <UiIcon name="book" size={18} />
      </div>
    );
  }

  return (
    <div className="relative aspect-[3/4] w-11 shrink-0 overflow-hidden rounded-md bg-accent">
      <Image alt={alt} className="object-cover" fill sizes="44px" src={src} unoptimized />
    </div>
  );
}
