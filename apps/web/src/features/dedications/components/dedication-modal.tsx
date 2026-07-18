"use client";

import type { BookView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useRef } from "react";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGenres } from "@/features/books/api/use-genres";
import { Link } from "@/i18n/navigation";

import { useDedicationActions } from "../hooks/use-dedication-actions";
import { restoreDedicationTriggerFocus } from "../model/dedication-focus";
import { authorNamesOf, dedicationTextOf } from "../model/dedication-item";
import { DedicationCover } from "./dedication-cover";

type DedicationModalProps = {
  book: BookView;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function DedicationModal({ book, onOpenChange, open }: DedicationModalProps) {
  const t = useTranslations("dedications");
  const genres = useGenres();
  const { copy, isTogglingFavorite, toggleFavorite } = useDedicationActions();
  const contentRef = useRef<HTMLDivElement>(null);

  const dedication = dedicationTextOf(book);
  const authorNames = authorNamesOf(book);
  const genreNameByKey = new Map((genres.data ?? []).map((genre) => [genre.key, genre.name]));

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-h-[90dvh] gap-0 overflow-y-auto sm:max-w-2xl"
        onCloseAutoFocus={(event) => restoreDedicationTriggerFocus(event, book.id)}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => contentRef.current?.focus());
        }}
        ref={contentRef}
        tabIndex={-1}
      >
        <DialogHeader className="flex-row items-start gap-4 space-y-0 text-left">
          <DedicationCover
            alt={t("card.coverAlt", { title: book.title })}
            className="aspect-[3/4] w-20 shrink-0"
            iconSize={24}
            sizes="80px"
            src={book.cover?.urls.thumb ?? null}
          />
          <div className="flex min-w-0 flex-col gap-1.5">
            <DialogTitle className="font-heading text-lg leading-snug text-ink">
              {book.title}
            </DialogTitle>
            <DialogDescription>
              {authorNames === "" ? t("card.unknownAuthor") : authorNames}
            </DialogDescription>
          </div>
        </DialogHeader>

        <blockquote className="mt-5 border-l-2 border-l-primary/60 pl-4 font-heading text-base leading-relaxed whitespace-pre-line text-foreground/90 italic sm:text-lg">
          {dedication}
        </blockquote>

        {book.genres.length === 0 ? null : (
          <div className="mt-5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{t("modal.genresLabel")}</span>
            {book.genres.map((genre) => (
              <Badge key={genre} variant="secondary">
                {genreNameByKey.get(genre) ?? genre}
              </Badge>
            ))}
          </div>
        )}

        {book.tags.length === 0 ? null : (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{t("modal.tagsLabel")}</span>
            {book.tags.map((tag) => (
              <Badge key={tag.id} variant="outline">
                {tag.name}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button asChild>
            <Link href={`/books/${book.id}`}>
              <UiIcon name="book" size={16} />
              {t("modal.openBook")}
            </Link>
          </Button>
          <Button onClick={() => void copy(dedication)} variant="secondary">
            <UiIcon name="copy" size={16} />
            {t("modal.copy")}
          </Button>
          <Button
            aria-pressed={book.isFavoriteDedication}
            disabled={isTogglingFavorite}
            onClick={() => toggleFavorite(book)}
            variant="secondary"
          >
            <UiIcon
              className={book.isFavoriteDedication ? "text-favorite" : undefined}
              name={book.isFavoriteDedication ? "heart-fill" : "heart"}
              size={16}
            />
            {t("modal.favorite")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
