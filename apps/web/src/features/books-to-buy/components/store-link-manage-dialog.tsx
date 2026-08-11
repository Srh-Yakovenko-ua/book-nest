"use client";

import type { BookStoreLinkView } from "@app/shared";

import { MAX_STORE_LINKS_PER_BOOK } from "@app/shared";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { isHttpsUrl } from "@/lib/is-https-url";
import { cn } from "@/lib/utils";

import type { StoreLinkBook } from "./store-link-dialog";

import { useBookStoreLinks } from "../api/use-book-store-links";
import { useDeleteStoreLinkWithUndo } from "../hooks/use-delete-store-link-with-undo";
import { findBestOfferLinkId } from "../model/best-offer-link";
import { formatStorePrice } from "../model/format-store-price";
import { hasMultipleCurrencies, sortStoreLinksByPrice } from "../model/store-link-prices";
import { StoreLinkForm } from "./store-link-dialog";

type ManageView = { kind: "create" } | { kind: "edit"; link: BookStoreLinkView } | { kind: "list" };

const listView = { kind: "list" } as const satisfies ManageView;

export function StoreLinkManageDialog({
  book,
  onOpenChange,
  open,
}: {
  book: StoreLinkBook;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [view, setView] = useState<ManageView>(listView);

  const changeOpen = (next: boolean) => {
    if (!next) setView(listView);
    onOpenChange(next);
  };

  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <DialogContent
        className="max-h-[88vh] overflow-y-auto sm:max-w-lg"
        onEscapeKeyDown={(event) => {
          if (view.kind === "list") return;
          event.preventDefault();
          setView(listView);
        }}
      >
        {open ? (
          <StoreLinkManageContent
            book={book}
            onClose={() => changeOpen(false)}
            onViewChange={setView}
            view={view}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function StoreLinkManageContent({
  book,
  onClose,
  onViewChange,
  view,
}: {
  book: StoreLinkBook;
  onClose: () => void;
  onViewChange: (view: ManageView) => void;
  view: ManageView;
}) {
  const t = useTranslations("booksToBuy.storeLinks");
  const tDialog = useTranslations("booksToBuy.storeLinks.manageDialog");
  const tErrors = useTranslations("books.details.ownership.errors");
  const storeLinksQuery = useBookStoreLinks(book.id);
  const deleteWithUndo = useDeleteStoreLinkWithUndo(book.id);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const previousViewRef = useRef(view);

  useEffect(() => {
    const previousView = previousViewRef.current;
    previousViewRef.current = view;

    if (view.kind !== "list" || previousView.kind === "list") return;

    if (previousView.kind === "create") {
      addButtonRef.current?.focus();
      return;
    }

    const editButton = listRef.current?.querySelector(`[data-edit-link="${previousView.link.id}"]`);
    if (editButton instanceof HTMLElement) editButton.focus();
  }, [view]);

  const returnToList = () => onViewChange(listView);

  if (view.kind !== "list") {
    return (
      <>
        <button
          className="inline-flex w-fit cursor-pointer items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
          onClick={returnToList}
          type="button"
        >
          <UiIcon aria-hidden name="arrow-left" size={16} />
          {tDialog("back")}
        </button>
        <StoreLinkForm
          book={book}
          link={view.kind === "edit" ? view.link : undefined}
          onDone={returnToList}
        />
      </>
    );
  }

  const { bestOffer, storeLinks } = storeLinksQuery.data ?? { bestOffer: null, storeLinks: [] };
  const sortedLinks = sortStoreLinksByPrice(storeLinks);
  const bestOfferLinkId = findBestOfferLinkId({ bestOffer, storeLinks });
  const canAddLink = storeLinks.length < MAX_STORE_LINKS_PER_BOOK;

  const removeLink = (link: BookStoreLinkView, nextLink: BookStoreLinkView | undefined) => {
    moveFocusOff(nextLink);
    deleteWithUndo(link);
  };

  const moveFocusOff = (nextLink: BookStoreLinkView | undefined) => {
    if (nextLink === undefined) {
      addButtonRef.current?.focus();
      return;
    }

    const nextEditButton = listRef.current?.querySelector(`[data-edit-link="${nextLink.id}"]`);
    if (nextEditButton instanceof HTMLElement) nextEditButton.focus();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{tDialog("title")}</DialogTitle>
        <DialogDescription>{book.title}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-muted-foreground">
          {canAddLink
            ? tDialog("counter", { count: storeLinks.length, max: MAX_STORE_LINKS_PER_BOOK })
            : tDialog("limitReached")}
        </p>
        {hasMultipleCurrencies(storeLinks) ? (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <UiIcon className="mt-0.5 shrink-0" name="info" size={12} />
            {tDialog("currencyHint")}
          </p>
        ) : null}
      </div>

      {storeLinksQuery.isError ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {tErrors("storeLinksUnavailable")}
        </p>
      ) : null}

      {storeLinksQuery.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : null}

      {sortedLinks.length > 0 ? (
        <ul aria-label={tDialog("title")} className="flex min-w-0 flex-col gap-2" ref={listRef}>
          {sortedLinks.map((link, index) => (
            <StoreLinkRow
              isCheapest={link.id === bestOfferLinkId}
              key={link.id}
              link={link}
              onDelete={() => removeLink(link, sortedLinks[index + 1])}
              onEdit={() => onViewChange({ kind: "edit", link })}
            />
          ))}
        </ul>
      ) : null}

      {storeLinksQuery.isSuccess && sortedLinks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          {tDialog("empty")}
        </p>
      ) : null}

      <DialogFooter className={canAddLink ? "sm:justify-between" : undefined}>
        {canAddLink ? (
          <Button onClick={() => onViewChange({ kind: "create" })} ref={addButtonRef} type="button">
            <UiIcon name="plus" size={14} />
            {t("add")}
          </Button>
        ) : null}
        <Button onClick={onClose} type="button" variant="secondary">
          {tDialog("close")}
        </Button>
      </DialogFooter>
    </>
  );
}

function StoreLinkRow({
  isCheapest,
  link,
  onDelete,
  onEdit,
}: {
  isCheapest: boolean;
  link: BookStoreLinkView;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const t = useTranslations("booksToBuy.storeLinks");
  const tDialog = useTranslations("booksToBuy.storeLinks.manageDialog");
  const locale = useLocale();
  const priceText =
    link.price === null
      ? null
      : formatStorePrice({ currency: link.currency, locale, price: link.price });

  return (
    <li
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2",
        isCheapest ? "border-success/30 bg-success-soft/40" : "border-border bg-muted/30",
      )}
    >
      <UiIcon className="mt-1.5 shrink-0 text-muted-foreground" name="store" size={14} />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 py-0.5">
        <StoreNameLink link={link} />
        {priceText === null ? null : (
          <span
            className={cn(
              "text-sm tabular-nums",
              isCheapest ? "font-semibold text-success" : "text-muted-foreground",
            )}
          >
            {priceText}
          </span>
        )}
        {isCheapest ? (
          <span className="rounded-full bg-success-soft px-2 py-0.5 text-[0.65rem] font-medium text-success">
            {tDialog("cheapest")}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          aria-label={t("edit", { store: link.storeName })}
          data-edit-link={link.id}
          onClick={onEdit}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <UiIcon name="edit" size={14} />
        </Button>
        <Button
          aria-label={t("delete", { store: link.storeName })}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onDelete}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <UiIcon name="trash" size={14} />
        </Button>
      </div>
    </li>
  );
}

function StoreNameLink({ link }: { link: BookStoreLinkView }) {
  const tCommon = useTranslations("common");

  if (!isHttpsUrl(link.url)) {
    return (
      <span className="min-w-0 truncate text-sm font-medium text-foreground">{link.storeName}</span>
    );
  }

  return (
    <a
      className="inline-flex min-w-0 items-center gap-1 rounded-md text-sm font-medium text-foreground transition-colors outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
      href={link.url}
      rel="noopener noreferrer"
      target="_blank"
      title={link.url}
    >
      <span className="min-w-0 truncate">{link.storeName}</span>
      <UiIcon className="text-muted-foreground" name="external" size={12} />
      <span className="sr-only">{tCommon("opensInNewTab")}</span>
    </a>
  );
}
