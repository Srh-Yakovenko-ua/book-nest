"use client";

import type { BookView } from "@app/shared";

import { Quote } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { GenreIcon, isGenreIconName, UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

const visibleTagCount = 3;

export function DedicationModal({ book, onOpenChange, open }: DedicationModalProps) {
  const t = useTranslations("dedications");
  const genres = useGenres();
  const { copy, isTogglingFavorite, toggleFavorite } = useDedicationActions();
  const contentRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const copyResetRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(
    () => () => {
      if (copyResetRef.current !== undefined) clearTimeout(copyResetRef.current);
    },
    [],
  );

  const dedication = dedicationTextOf(book);
  const authorNames = authorNamesOf(book);
  const bookHref = `/books/${book.id}`;
  const genreNameByKey = new Map((genres.data ?? []).map((genre) => [genre.key, genre.name]));

  const visibleTags = book.tags.slice(0, visibleTagCount);
  const hiddenTagCount = book.tags.length - visibleTags.length;

  const onCopy = async () => {
    const ok = await copy(dedication);
    if (!ok) return;
    setCopied(true);
    if (copyResetRef.current !== undefined) clearTimeout(copyResetRef.current);
    copyResetRef.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-h-[90dvh] gap-4 overflow-y-auto sm:max-w-2xl"
        onCloseAutoFocus={(event) => restoreDedicationTriggerFocus(event, book.id)}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => contentRef.current?.focus());
        }}
        ref={contentRef}
        tabIndex={-1}
      >
        <DialogHeader className="flex-row items-start gap-4 space-y-0 text-left">
          <Link
            className="shrink-0 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            href={bookHref}
            tabIndex={-1}
          >
            <DedicationCover
              alt={t("card.coverAlt", { title: book.title })}
              className="aspect-[3/4] w-20 shrink-0"
              iconSize={24}
              sizes="80px"
              src={book.cover?.urls.thumb ?? null}
            />
          </Link>
          <div className="flex min-w-0 flex-col gap-1.5">
            <DialogTitle className="font-heading text-lg leading-snug text-ink">
              <Link
                className="rounded-sm transition-colors outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
                href={bookHref}
              >
                {book.title}
              </Link>
            </DialogTitle>
            <DialogDescription>
              {authorNames === "" ? t("card.unknownAuthor") : authorNames}
            </DialogDescription>
            {book.genres.length === 0 ? null : (
              <ul className="mt-0.5 flex flex-wrap gap-1.5">
                {book.genres.map((key) => (
                  <li
                    className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-tag px-2.5 py-1 text-xs font-medium text-tag-foreground"
                    key={key}
                  >
                    {isGenreIconName(key) ? (
                      <GenreIcon className="shrink-0 text-brand/90" name={key} size={14} />
                    ) : null}
                    <span className="min-w-0 truncate">{genreNameByKey.get(key) ?? key}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogHeader>

        <div className="rounded-lg border-l-2 border-l-primary/70 bg-secondary/40 p-4">
          <Quote aria-hidden className="mb-2 text-primary/60" size={20} />
          <blockquote className="max-h-[40vh] overflow-y-auto font-heading text-base leading-relaxed whitespace-pre-line text-foreground/90 italic sm:text-lg">
            {dedication}
          </blockquote>
        </div>

        {book.tags.length === 0 ? null : (
          <ul className="flex flex-wrap gap-1.5">
            {visibleTags.map((tag) => (
              <li
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-xs font-medium text-foreground/80"
                key={tag.id}
              >
                <UiIcon className="shrink-0 text-muted-foreground" name="hash" size={12} />
                <span className="min-w-0 truncate">{tag.name}</span>
              </li>
            ))}
            {hiddenTagCount === 0 ? null : (
              <li
                aria-label={t("modal.moreTags", { count: hiddenTagCount })}
                className="inline-flex items-center rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-xs font-medium text-muted-foreground"
              >
                +{hiddenTagCount}
              </li>
            )}
          </ul>
        )}

        <DialogFooter>
          <Button
            aria-pressed={book.isFavoriteDedication}
            className={
              book.isFavoriteDedication
                ? "border-favorite/40 bg-favorite-soft text-favorite hover:bg-favorite-soft hover:text-favorite dark:bg-favorite-soft dark:hover:bg-favorite-soft"
                : undefined
            }
            disabled={isTogglingFavorite}
            onClick={() => toggleFavorite(book)}
            variant="outline"
          >
            <UiIcon name={book.isFavoriteDedication ? "heart-fill" : "heart"} size={16} />
            {book.isFavoriteDedication ? t("modal.removeFavorite") : t("modal.addFavorite")}
          </Button>
          <Button onClick={() => void onCopy()}>
            <UiIcon name={copied ? "check" : "copy"} size={16} />
            {copied ? t("modal.copied") : t("modal.copy")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
