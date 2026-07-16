"use client";

import type { WishlistBookView } from "@app/shared";

import { MAX_STORE_LINKS_PER_BOOK, STORE_LINK_ERROR_CODES } from "@app/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeliveryDialog, MarkBoughtDialog, useRemoveFromWishlist } from "@/features/books";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/http-client";

import { wishlistKeys } from "../api/wishlist-keys";
import { RemoveFromWishlistDialog } from "./remove-from-wishlist-dialog";
import { StoreLinkDialog } from "./store-link-dialog";
import { StoreLinksList } from "./store-links-list";

export function BooksToBuyRow({ book }: { book: WishlistBookView }) {
  const t = useTranslations("booksToBuy");
  const queryClient = useQueryClient();
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [markBoughtOpen, setMarkBoughtOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const removeFromWishlist = useRemoveFromWishlist();
  const authorNames = book.authors.map((author) => author.name).join(", ");
  const canAddLink = book.storeLinks.length < MAX_STORE_LINKS_PER_BOOK;

  const onConfirmRemove = () =>
    removeFromWishlist.mutate(book.id, {
      onError: (error) => {
        if (isNotInWishlist(error)) {
          void queryClient.invalidateQueries({ queryKey: wishlistKeys.root });
          toast.error(t("removeFromList.notInWishlist"));
          return;
        }
        toast.error(t("removeFromList.error"));
      },
      onSuccess: () => {
        setRemoveOpen(false);
        toast.success(t("removeFromList.success"));
      },
    });

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
        <StoreLinksList
          bestOffer={book.bestOffer}
          book={book}
          className="sm:w-56 sm:shrink-0 md:w-64"
          storeLinks={book.storeLinks}
        />
        <div className="flex shrink-0 items-center gap-1.5 self-start sm:self-auto">
          <Button
            aria-label={t("markBoughtFor", { title: book.title })}
            onClick={() => setMarkBoughtOpen(true)}
            size="sm"
          >
            <UiIcon name="check-circle" size={16} />
            {t("markBought")}
          </Button>
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
            <DropdownMenuContent align="end">
              {canAddLink ? (
                <DropdownMenuItem onSelect={() => setAddLinkOpen(true)}>
                  <UiIcon name="plus" size={14} />
                  {t("storeLinks.add")}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={() => setDeliveryOpen(true)}>
                <UiIcon name="truck" size={14} />
                {t("markInTransit")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setRemoveOpen(true)}>
                <UiIcon name="x-circle" size={14} />
                {t("removeFromList.action")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <MarkBoughtDialog
        book={book}
        onOpenChange={setMarkBoughtOpen}
        onSuccess={() => toast.success(t("markBoughtSuccess"))}
        open={markBoughtOpen}
      />
      <StoreLinkDialog book={book} mode="create" onOpenChange={setAddLinkOpen} open={addLinkOpen} />
      <DeliveryDialog
        book={book}
        mode="create"
        onOpenChange={setDeliveryOpen}
        open={deliveryOpen}
      />
      <RemoveFromWishlistDialog
        isPending={removeFromWishlist.isPending}
        onConfirm={onConfirmRemove}
        onOpenChange={setRemoveOpen}
        open={removeOpen}
      />
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

function isNotInWishlist(error: unknown): boolean {
  return error instanceof ApiError && error.code === STORE_LINK_ERROR_CODES.NOT_IN_WISHLIST;
}
