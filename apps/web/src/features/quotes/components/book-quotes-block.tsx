"use client";

import type { BookQuotesView, BookView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FormSection } from "@/features/books";
import { Link } from "@/i18n/navigation";

import { useBookQuotes } from "../api/use-book-quotes";
import { toQuoteBookOption } from "../model/quote-book";
import { QuoteCard } from "./quote-card";
import { QuoteDialog } from "./quote-dialog";

const BOOK_QUOTES_PREVIEW_LIMIT = 3;

export function BookQuotesBlock({ book }: { book: BookView }) {
  const t = useTranslations("quotes");
  const [addOpen, setAddOpen] = useState(false);
  const quotesQuery = useBookQuotes(book.id);

  const view = quotesQuery.data;
  const hasQuotes = view !== undefined && view.totalCount > 0;

  return (
    <>
      <FormSection
        action={
          <Button onClick={() => setAddOpen(true)} size="sm">
            <UiIcon name="plus" size={14} />
            {t("actions.add")}
          </Button>
        }
        description={
          hasQuotes
            ? t("bookBlock.summary", {
                favorites: view.favoritesCount,
                spoilers: view.spoilerCount,
                total: view.totalCount,
              })
            : undefined
        }
        icon="quote"
        title={
          hasQuotes
            ? t("bookBlock.titleWithCount", { count: view.totalCount })
            : t("bookBlock.title")
        }
      >
        {quotesQuery.isPending ? <BookQuotesSkeleton /> : null}

        {!quotesQuery.isPending && view === undefined ? (
          <BookQuotesError onRetry={() => void quotesQuery.refetch()} />
        ) : null}

        {view === undefined ? null : (
          <BookQuotesList book={book} onAdd={() => setAddOpen(true)} view={view} />
        )}
      </FormSection>

      <QuoteDialog
        book={toQuoteBookOption(book)}
        maxPage={book.pagesCount ?? undefined}
        mode="create"
        onOpenChange={setAddOpen}
        open={addOpen}
      />
    </>
  );
}

function BookQuotesEmpty({ onAdd }: { onAdd: () => void }) {
  const t = useTranslations("quotes.bookBlock.empty");
  const tActions = useTranslations("quotes.actions");

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-8 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-accent text-icon">
        <UiIcon name="quote" size={22} />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-heading text-sm font-semibold text-ink">{t("title")}</p>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{t("description")}</p>
      </div>
      <Button className="mt-1" onClick={onAdd} size="sm" variant="secondary">
        <UiIcon name="plus" size={14} />
        {tActions("add")}
      </Button>
    </div>
  );
}

function BookQuotesError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("quotes");

  return (
    <div className="flex flex-col items-start gap-2.5 rounded-lg border border-border bg-card p-4">
      <p className="inline-flex items-center gap-1.5 text-sm font-medium text-destructive">
        <UiIcon name="alert-circle" size={16} />
        {t("error.load")}
      </p>
      <Button onClick={onRetry} size="sm" variant="secondary">
        <UiIcon name="refresh" size={14} />
        {t("actions.retry")}
      </Button>
    </div>
  );
}

function BookQuotesList({
  book,
  onAdd,
  view,
}: {
  book: BookView;
  onAdd: () => void;
  view: BookQuotesView;
}) {
  const t = useTranslations("quotes.bookBlock");

  if (view.items.length === 0) return <BookQuotesEmpty onAdd={onAdd} />;

  const latestQuotes = [...view.items]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, BOOK_QUOTES_PREVIEW_LIMIT);

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {latestQuotes.map((quote) => (
          <li key={quote.id}>
            <QuoteCard maxPage={book.pagesCount ?? undefined} quote={quote} />
          </li>
        ))}
      </ul>

      {view.totalCount > latestQuotes.length ? (
        <Button asChild className="self-start" size="sm" variant="ghost">
          <Link href={`/quotes?bookId=${book.id}`}>
            {t("viewAll")}
            <UiIcon name="arrow-right" size={14} />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

function BookQuotesSkeleton() {
  const t = useTranslations("quotes");

  return (
    <div aria-busy className="flex flex-col gap-3" role="status">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
    </div>
  );
}
