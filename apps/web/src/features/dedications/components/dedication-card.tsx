"use client";

import type { BookView } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "@/i18n/navigation";

import { useDedicationActions } from "../hooks/use-dedication-actions";
import { authorNamesOf, dedicationTextOf } from "../model/dedication-item";
import { DedicationCover } from "./dedication-cover";

type DedicationCardProps = {
  book: BookView;
  onOpen: () => void;
};

export function DedicationCard({ book, onOpen }: DedicationCardProps) {
  const t = useTranslations("dedications.card");
  const { copy, isTogglingFavorite, toggleFavorite } = useDedicationActions();

  const dedication = dedicationTextOf(book);
  const authorNames = authorNamesOf(book);
  const bookHref = `/books/${book.id}`;
  const favoriteLabel = book.isFavoriteDedication ? t("removeFavorite") : t("addFavorite");

  return (
    <article className="group relative flex h-full w-full flex-col gap-3 rounded-[18px] border border-border bg-card p-4 shadow-card transition-[box-shadow,border-color] duration-200 ease-out hover:border-accent-border hover:shadow-hover motion-reduce:transition-none">
      <div className="relative z-10 flex items-start gap-3">
        <Link
          className="shrink-0 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          href={bookHref}
          tabIndex={-1}
        >
          <DedicationCover
            alt={t("coverAlt", { title: book.title })}
            className="aspect-[3/4] w-12"
            iconSize={16}
            sizes="48px"
            src={book.cover?.urls.thumb ?? null}
          />
        </Link>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="font-heading text-sm leading-snug font-bold text-ink">
            <Link
              className="line-clamp-2 rounded-sm transition-colors outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
              href={bookHref}
            >
              {book.title}
            </Link>
          </h3>
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {authorNames === "" ? t("unknownAuthor") : authorNames}
          </p>
        </div>
      </div>

      <button
        aria-label={t("read", { title: book.title })}
        className="h-24 cursor-pointer rounded-md text-left outline-none after:absolute after:inset-0 after:rounded-[18px] after:content-[''] focus-visible:ring-3 focus-visible:ring-ring/50"
        data-dedication-trigger={book.id}
        onClick={onOpen}
        type="button"
      >
        <blockquote className="line-clamp-4 border-l-2 border-l-primary/60 pl-3 text-sm leading-relaxed whitespace-pre-line text-foreground/85 italic">
          {dedication}
        </blockquote>
      </button>

      <div className="relative z-10 flex items-center gap-1 border-t border-border/60 pt-2.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={t("copy")}
              onClick={() => void copy(dedication)}
              size="icon-sm"
              variant="ghost"
            >
              <UiIcon name="copy" size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("copy")}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={favoriteLabel}
              aria-pressed={book.isFavoriteDedication}
              className="ml-auto"
              disabled={isTogglingFavorite}
              onClick={() => toggleFavorite(book)}
              size="icon-sm"
              variant="ghost"
            >
              <UiIcon
                className={book.isFavoriteDedication ? "text-favorite" : undefined}
                name={book.isFavoriteDedication ? "heart-fill" : "heart"}
                size={16}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{favoriteLabel}</TooltipContent>
        </Tooltip>
      </div>
    </article>
  );
}
