"use client";

import type { Nullable, QuoteView } from "@app/shared";

import { useTranslations } from "next-intl";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "@/i18n/navigation";
import { copyText } from "@/lib/copy-text";
import { cn } from "@/lib/utils";

import { useDeleteQuote, useUpdateQuote } from "../../api/use-quote-mutations";
import { DeleteQuoteDialog } from "../delete-quote-dialog";
import { QuoteDialog } from "../quote-dialog";

type QuoteActionsProps = {
  bookHref: Nullable<string>;
  className?: string;
  maxPage?: number;
  quote: QuoteView;
};

export function QuoteActions({ bookHref, className, maxPage, quote }: QuoteActionsProps) {
  const tActions = useTranslations("quotes.actions");
  const tCopy = useTranslations("quotes.copy");
  const tDelete = useTranslations("quotes.delete");
  const tFavorite = useTranslations("quotes.favorite");

  const [isEditOpen, setEditOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const updateQuote = useUpdateQuote();
  const deleteQuote = useDeleteQuote();

  const favoriteLabel = quote.isFavorite ? tFavorite("remove") : tFavorite("add");

  function toggleFavorite() {
    updateQuote.mutate(
      { bookId: quote.bookId, input: { isFavorite: !quote.isFavorite }, quoteId: quote.id },
      {
        onError: () => toast.error(tFavorite("error")),
        onSuccess: (updated) =>
          toast.success(updated.isFavorite ? tFavorite("added") : tFavorite("removed")),
      },
    );
  }

  async function copyQuote() {
    const copied = await copyText(quote.text);
    if (copied) {
      toast.success(tCopy("success"));
      return;
    }
    toast.error(tCopy("error"));
  }

  function removeQuote() {
    deleteQuote.mutate(
      { bookId: quote.bookId, quoteId: quote.id },
      {
        onError: () => toast.error(tDelete("error")),
        onSuccess: () => {
          setDeleteOpen(false);
          toast.success(tDelete("success"));
        },
      },
    );
  }

  return (
    <div className={cn("flex shrink-0 items-center gap-0.5", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={favoriteLabel}
            aria-pressed={quote.isFavorite}
            disabled={updateQuote.isPending}
            onClick={toggleFavorite}
            size="icon-sm"
            variant="ghost"
          >
            <UiIcon
              className={quote.isFavorite ? "text-favorite" : "text-muted-foreground"}
              name={quote.isFavorite ? "heart-fill" : "heart"}
              size={16}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{favoriteLabel}</TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-label={tActions("menuLabel")} size="icon-sm" variant="ghost">
            <UiIcon className="text-muted-foreground" name="more" size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <UiIcon name="edit" size={14} />
            {tActions("edit")}
          </DropdownMenuItem>
          {bookHref === null ? null : (
            <DropdownMenuItem asChild>
              <Link href={bookHref}>
                <UiIcon name="book" size={14} />
                {tActions("openBook")}
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => void copyQuote()}>
            <UiIcon name="copy" size={14} />
            {tActions("copy")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDeleteOpen(true)} variant="destructive">
            <UiIcon name="trash" size={14} />
            {tActions("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <QuoteDialog
        book={{
          authorName: quote.book.firstAuthorName,
          cover: quote.book.cover,
          id: quote.book.id,
          title: quote.book.title,
        }}
        maxPage={maxPage}
        mode="edit"
        onOpenChange={setEditOpen}
        open={isEditOpen}
        quote={quote}
      />

      <DeleteQuoteDialog
        isPending={deleteQuote.isPending}
        onConfirm={removeQuote}
        onOpenChange={setDeleteOpen}
        open={isDeleteOpen}
      />
    </div>
  );
}
