"use client";

import type { BookView } from "@app/shared";

import { MAX_STORE_LINKS_PER_BOOK } from "@app/shared";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import { useBookStoreLinks } from "../api/use-book-store-links";
import { StoreLinkDialog } from "./store-link-dialog";
import { StoreLinksList } from "./store-links-list";

export function BookStoreLinksBlock({ book }: { book: BookView }) {
  const t = useTranslations("books.details.ownership.storeLinks");
  const [addOpen, setAddOpen] = useState(false);
  const storeLinksQuery = useBookStoreLinks(book.id);

  if (storeLinksQuery.status !== "success") return null;

  const { bestOffer, storeLinks } = storeLinksQuery.data;
  if (book.ownershipStatus !== "want_to_buy" && storeLinks.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-foreground">{t("title")}</p>
      <StoreLinksList bestOffer={bestOffer} book={book} storeLinks={storeLinks} />
      {storeLinks.length < MAX_STORE_LINKS_PER_BOOK ? (
        <Button className="w-full" onClick={() => setAddOpen(true)} size="sm" variant="secondary">
          <UiIcon name="plus" size={14} />
          {t("add")}
        </Button>
      ) : null}
      <StoreLinkDialog book={book} mode="create" onOpenChange={setAddOpen} open={addOpen} />
    </div>
  );
}
