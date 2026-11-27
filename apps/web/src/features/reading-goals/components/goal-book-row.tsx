"use client";

import type { Nullable, ReadingGoalBookView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";

import { BookCoverFallback } from "@/components/book-cover-fallback";
import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { assertNever } from "@/lib/assert-never";
import { formatDate } from "@/lib/format";

import type { GoalBookPages, GoalBookState } from "../model/goal-book-state";

import { resolveGoalBookState } from "../model/goal-book-state";

const GOAL_BOOK_ROW = {
  cover:
    "relative grid aspect-3/4 w-12 shrink-0 place-items-center overflow-hidden rounded-sm bg-accent text-icon",
  coverSizes: "48px",
} as const;

type GoalBookRowProps = {
  book: ReadingGoalBookView;
};

type GoalBookStateLabel = {
  label: string;
  note: Nullable<string>;
  tone: "info" | "secondary" | "success";
};

export function GoalBookRow({ book }: GoalBookRowProps) {
  const authors = book.authors.map((author) => author.name).join(", ");

  return (
    <li className="min-w-0">
      <Link
        className="group flex h-full items-start gap-3 rounded-lg border border-border bg-card p-3 no-underline transition-colors outline-none hover:border-accent-border hover:bg-accent/40 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
        href={`/books/${book.id}`}
      >
        <GoalBookCover book={book} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="line-clamp-2 text-sm leading-snug font-medium break-words text-ink group-hover:text-primary">
            {book.title}
          </p>
          {authors === "" ? null : (
            <p className="truncate text-xs text-muted-foreground">{authors}</p>
          )}
          <GoalBookStateLine state={resolveGoalBookState(book)} />
        </div>
      </Link>
    </li>
  );
}

export function GoalBookRowSkeleton() {
  return (
    <li className="flex min-w-0 items-start gap-3 rounded-lg border border-border bg-card p-3">
      <Skeleton className="aspect-3/4 w-12 shrink-0 rounded-sm" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-3/4 rounded-md" />
        <Skeleton className="h-3 w-1/2 rounded-md" />
        <Skeleton className="h-6 w-28 rounded-full" />
      </div>
    </li>
  );
}

function GoalBookCover({ book }: GoalBookRowProps) {
  return (
    <div className={GOAL_BOOK_ROW.cover}>
      {book.cover === null ? (
        <BookCoverFallback className="size-full" seed={book.id} sizes={GOAL_BOOK_ROW.coverSizes} />
      ) : (
        <Image
          alt=""
          className="object-cover"
          fill
          sizes={GOAL_BOOK_ROW.coverSizes}
          src={book.cover.urls.thumb}
          unoptimized
        />
      )}
    </div>
  );
}

function GoalBookPagesBar({ percent }: { percent: number }) {
  const t = useTranslations("goals.detail.books");

  return (
    <Progress
      aria-label={t("pagesProgressLabel", { percent })}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={percent}
      className="h-1.5 max-w-60 *:motion-reduce:transition-none"
      value={percent}
    />
  );
}

function GoalBookStateLine({ state }: { state: GoalBookState }) {
  const t = useTranslations("goals.detail");
  const tStatus = useTranslations("books.readingStatus.options");
  const locale = useLocale();

  function describePages(pages: GoalBookPages): string {
    switch (pages.kind) {
      case "with-total":
        return t("books.pages", {
          current: pages.current,
          percent: pages.percent,
          total: pages.total,
        });
      case "without-total":
        return t("books.pagesWithoutTotal", { current: pages.current });
      default:
        return assertNever(pages);
    }
  }

  function describe(): GoalBookStateLabel {
    switch (state.kind) {
      case "counted":
        return {
          label: t("books.counted"),
          note:
            state.countedFinishedAt === null
              ? null
              : t("finishedOn", { date: formatDate(state.countedFinishedAt, locale) }),
          tone: "success",
        };
      case "finished-outside-window":
        return {
          label: t("books.notCounted"),
          note: t("books.finishedOutsideWindow", { date: formatDate(state.finishedAt, locale) }),
          tone: "secondary",
        };
      case "finished-without-date":
        return {
          label: t("books.notCounted"),
          note: t("books.finishedWithoutDate"),
          tone: "secondary",
        };
      case "in-progress":
        return { label: tStatus(state.status), note: describePages(state.pages), tone: "info" };
      case "status-only":
        return { label: tStatus(state.status), note: null, tone: "secondary" };
      default:
        return assertNever(state);
    }
  }

  const { label, note, tone } = describe();

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge className="h-6 px-2.5" variant={tone}>
          {tone === "success" ? <UiIcon aria-hidden name="check" /> : null}
          {label}
        </Badge>
        {note === null ? null : (
          <span className="text-xs text-muted-foreground tabular-nums">{note}</span>
        )}
      </div>
      {state.kind === "in-progress" && state.pages.kind === "with-total" ? (
        <GoalBookPagesBar percent={state.pages.percent} />
      ) : null}
    </div>
  );
}
