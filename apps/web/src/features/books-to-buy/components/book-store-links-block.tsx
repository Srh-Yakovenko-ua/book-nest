"use client";

import type { BookView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import { useBookStoreLinks } from "../api/use-book-store-links";
import { StoreLinkManageDialog } from "./store-link-manage-dialog";
import { StoreLinksList } from "./store-links-list";

export function BookStoreLinksBlock({ book }: { book: BookView }) {
  const t = useTranslations("books.details.ownership.storeLinks");
  const tStoreLinks = useTranslations("booksToBuy.storeLinks");
  const [manageOpen, setManageOpen] = useState(false);
  const storeLinksQuery = useBookStoreLinks(book.id);

  if (storeLinksQuery.status !== "success") return null;

  const { bestOffer, storeLinks } = storeLinksQuery.data;
  if (book.ownershipStatus !== "want_to_buy" && storeLinks.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-foreground">{t("title")}</p>
      <StoreLinksList bestOffer={bestOffer} label={t("title")} storeLinks={storeLinks} />
      <Button className="w-full" onClick={() => setManageOpen(true)} size="sm" variant="secondary">
        <UiIcon name="store" size={14} />
        {tStoreLinks("manageAction")}
      </Button>
      <StoreLinkManageDialog book={book} onOpenChange={setManageOpen} open={manageOpen} />
    </div>
  );
}
