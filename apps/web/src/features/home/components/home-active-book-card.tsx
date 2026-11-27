"use client";

import type { HomeActiveBook, Nullable } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import { assertNever } from "@/lib/assert-never";

import type { HomeActiveBookAction } from "../model/home-active-book-dialog";

import { activeBookProgress, activeBookUpdate } from "../model/home-active-books";
import { homeBookHref } from "../model/home-library-links";
import { HomeBookCover } from "./home-book-cover";

type HomeActiveBookCardProps = {
  book: HomeActiveBook;
  isOpening: boolean;
  onAction: (action: HomeActiveBookAction) => void;
  today: string;
};

export function HomeActiveBookCard({ book, isOpening, onAction, today }: HomeActiveBookCardProps) {
  const t = useTranslations("home.reading");
  const authors = book.authors.map((author) => author.name).join(", ");

  return (
    <article className="flex h-full w-full min-w-0 gap-3 rounded-lg border border-border bg-background p-3">
      <Link
        aria-hidden
        className="w-16 shrink-0 cursor-pointer @md/reading:w-20"
        href={homeBookHref(book.id)}
        tabIndex={-1}
      >
        <HomeBookCover className="w-full" cover={book.cover} seed={book.id} sizes="5rem" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h3 className="min-w-0 text-base leading-snug font-semibold">
            <Link
              className="line-clamp-2 cursor-pointer rounded-sm wrap-anywhere text-ink outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
              href={homeBookHref(book.id)}
            >
              {book.title}
            </Link>
          </h3>
          {book.readingStatus === "rereading" ? (
            <Badge className="shrink-0" variant="info">
              <UiIcon aria-hidden name="repeat-2" size={12} />
              {t("rereading")}
            </Badge>
          ) : null}
        </div>
        {authors.length === 0 ? null : (
          <p className="line-clamp-1 text-sm wrap-anywhere text-muted-foreground">{authors}</p>
        )}
        {book.series === null ? null : (
          <p className="line-clamp-1 text-xs wrap-anywhere text-muted-foreground">
            {book.series.partNumber === null
              ? book.series.name
              : t("seriesPart", { name: book.series.name, part: book.series.partNumber })}
          </p>
        )}
        <ActiveBookProgress book={book} />
        <ActiveBookUpdate lastProgressAt={book.lastProgressAt} today={today} />
        <div className="mt-auto flex items-center gap-2 pt-1">
          <Button
            className="min-w-0 flex-1 @md/reading:flex-none"
            loading={isOpening}
            onClick={() => onAction("progress")}
            size="sm"
          >
            <UiIcon aria-hidden name="edit" size={14} />
            <span className="truncate">{t("updateProgress")}</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={t("menu.label", { title: book.title })}
                disabled={isOpening}
                size="icon-sm"
                variant="ghost"
              >
                <UiIcon aria-hidden name="more" size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={homeBookHref(book.id)}>
                  <UiIcon aria-hidden name="book-open-text" size={16} />
                  {t("menu.open")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onAction("paused")}>
                <UiIcon aria-hidden name="clock" size={16} />
                {t("menu.pause")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAction("finished")}>
                <UiIcon aria-hidden name="check-circle" size={16} />
                {t("menu.finish")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </article>
  );
}

function ActiveBookProgress({ book }: { book: HomeActiveBook }) {
  const t = useTranslations("home.reading.progress");
  const progress = activeBookProgress(book);

  switch (progress.kind) {
    case "page":
      return (
        <ProgressLine
          label={
            progress.pagesCount === null
              ? t("page", { current: progress.currentPage })
              : t("pagesOf", { current: progress.currentPage, total: progress.pagesCount })
          }
          percent={progress.percent}
        />
      );
    case "percent":
      return <ProgressLine label={null} percent={progress.percent} />;
    case "unknown":
      return null;
    default:
      return assertNever(progress);
  }
}

function ActiveBookUpdate({
  lastProgressAt,
  today,
}: {
  lastProgressAt: HomeActiveBook["lastProgressAt"];
  today: string;
}) {
  const t = useTranslations("home.reading");
  const locale = useLocale();
  const update = activeBookUpdate({ lastProgressAt, today });
  if (update.kind === "unknown") return null;

  const when = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    -update.daysAgo,
    "day",
  );

  return (
    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
      <span>{t("updated", { when })}</span>
      {update.isStale ? <span className="text-foreground">{t("staleHint")}</span> : null}
    </div>
  );
}

function ProgressLine({ label, percent }: { label: Nullable<string>; percent: Nullable<number> }) {
  const t = useTranslations("home.reading.progress");

  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-baseline justify-between gap-2 text-xs text-foreground tabular-nums">
        {label === null ? null : <span className="min-w-0 wrap-anywhere">{label}</span>}
        {percent === null ? null : (
          <span className="ml-auto shrink-0 font-semibold text-primary">
            {t("percent", { percent })}
          </span>
        )}
      </p>
      {percent === null ? null : (
        <Progress
          aria-label={t("label", { percent })}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={percent}
          className="h-1.5"
          value={percent}
        />
      )}
    </div>
  );
}
