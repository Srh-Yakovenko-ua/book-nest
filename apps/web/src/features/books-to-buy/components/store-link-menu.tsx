"use client";

import type { BookStoreLinkView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { StoreLinkBook } from "./store-link-dialog";

import { useDeleteStoreLinkWithUndo } from "../hooks/use-delete-store-link-with-undo";
import { StoreLinkDialog } from "./store-link-dialog";

export function StoreLinkMenu({ book, link }: { book: StoreLinkBook; link: BookStoreLinkView }) {
  const t = useTranslations("booksToBuy.storeLinks");
  const [editOpen, setEditOpen] = useState(false);
  const deleteWithUndo = useDeleteStoreLinkWithUndo(book.id);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={t("menuLabel", { store: link.storeName })}
            className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
            type="button"
          >
            <UiIcon name="more" size={12} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <UiIcon name="edit" size={14} />
            {t("edit")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => deleteWithUndo(link)} variant="destructive">
            <UiIcon name="trash" size={14} />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <StoreLinkDialog
        book={book}
        link={link}
        mode="edit"
        onOpenChange={setEditOpen}
        open={editOpen}
      />
    </>
  );
}
