"use client";

import type { BookView, ReadingStatus, SeriesBookView, SeriesView } from "@app/shared";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { type ReactNode, useLayoutEffect, useRef } from "react";

import type { SeriesSlot } from "@/features/series";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { buildSeriesSlots, useSeriesDetails } from "@/features/series";
import { Link } from "@/i18n/navigation";
import { readingStatuses } from "@/lib/book-status";
import { cn } from "@/lib/utils";

import { computeSeriesSequenceHint, type SeriesSequenceHint } from "../model/series-sequence-hint";
import { FormSection } from "./form-section";

type ConnectorTone = "none" | "pale" | "strong";

const SKELETON_SLOTS = ["s1", "s2", "s3", "s4", "s5"] as const;

const SLOT_FADE =
  "opacity-[0.72] group-hover/slot:opacity-100 group-focus-within/slot:opacity-100 motion-safe:transition";

export function BookDetailsSeriesSequence({ book }: { book: BookView }) {
  if (book.series === null) return null;
  return <SeriesSequence book={book} series={book.series} />;
}

function AddedCover({ cover }: { cover: SeriesBookView["cover"] }) {
  if (cover === null || cover === undefined) {
    return (
      <div className="grid aspect-[2/3] w-full place-items-center rounded-md bg-accent text-accent-foreground/70">
        <UiIcon aria-hidden name="book" size={26} />
      </div>
    );
  }

  return (
    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md">
      <Image alt="" className="object-cover" fill sizes="128px" src={cover.urls.card} unoptimized />
    </div>
  );
}

function AddedSlot({
  book,
  connector,
  isCurrent,
  number,
}: {
  book: SeriesBookView;
  connector: ConnectorTone;
  isCurrent: boolean;
  number: null | number;
}) {
  const t = useTranslations("books.details.seriesSequence");

  const body = (
    <>
      <div className="relative w-full">
        <Connector tone={connector} />
        <SlotFrame
          badge={<NumberBadge>{number === null ? t("noNumberBadge") : number}</NumberBadge>}
          isCurrent={isCurrent}
          tone="added"
        >
          <AddedCover cover={book.cover} />
        </SlotFrame>
      </div>
      <p
        className={cn(
          "line-clamp-2 w-full text-center text-xs font-medium text-foreground/90",
          !isCurrent && cn(SLOT_FADE, "group-hover/slot:text-primary"),
        )}
      >
        {book.title}
      </p>
      <ReadingChip className={isCurrent ? undefined : SLOT_FADE} status={book.readingStatus} />
    </>
  );

  if (isCurrent) {
    return (
      <li
        aria-current="true"
        className="group/slot relative flex w-32 shrink-0 flex-col items-center gap-2"
        data-current="true"
      >
        {body}
      </li>
    );
  }

  return (
    <li className="group/slot relative flex w-32 shrink-0 flex-col items-center gap-2">
      <Link
        className="flex w-full flex-col items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        href={`/books/${book.id}`}
      >
        {body}
      </Link>
    </li>
  );
}

function assertNever(value: never): never {
  throw new Error(`Unhandled series-sequence slot: ${String(value)}`);
}

function bookLink(book: SeriesBookView) {
  return {
    book: (chunks: ReactNode) => (
      <Link className="font-medium text-primary hover:underline" href={`/books/${book.id}`}>
        {chunks}
      </Link>
    ),
    title: book.title,
  };
}

function Connector({ tone }: { tone: ConnectorTone }) {
  if (tone === "none") return null;
  const strong = tone === "strong";
  const color = strong ? "bg-brand" : "bg-accent-border";
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute top-1/2 -left-4 h-[5px] w-4 -translate-y-1/2",
        strong ? "opacity-100" : "opacity-60",
      )}
    >
      <span
        className={cn("absolute top-1/2 left-0 h-0.5 w-full -translate-y-1/2 rounded-full", color)}
      />
      <span
        className={cn("absolute top-1/2 left-0 size-[5px] -translate-y-1/2 rounded-full", color)}
      />
      <span
        className={cn(
          "absolute top-1/2 left-1/2 size-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full",
          color,
        )}
      />
      <span
        className={cn("absolute top-1/2 right-0 size-[5px] -translate-y-1/2 rounded-full", color)}
      />
    </span>
  );
}

function connectorTone(previous: null | SeriesSlot, current: SeriesSlot): ConnectorTone {
  if (previous === null) return "none";
  if (
    previous.kind === "added" &&
    current.kind === "added" &&
    previous.number !== null &&
    current.number !== null &&
    previous.number === current.number
  ) {
    return "none";
  }
  const neighborIsCurrent =
    (previous.kind === "added" && previous.isCurrent) ||
    (current.kind === "added" && current.isCurrent);
  return neighborIsCurrent ? "strong" : "pale";
}

function HintFrame({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
      <UiIcon aria-hidden className="mt-0.5 shrink-0 text-icon" name="arrow-right" size={15} />
      <span>{children}</span>
    </p>
  );
}

function HintLine({ hint }: { hint: SeriesSequenceHint }) {
  const t = useTranslations("books.details.seriesSequence");

  switch (hint.kind) {
    case "afterAdded":
      return <HintFrame>{t.rich("hintAfterAdded", bookLink(hint.book))}</HintFrame>;
    case "afterMissing":
      return <HintFrame>{t("hintAfterMissing", { number: hint.number })}</HintFrame>;
    case "beforeAdded":
      return <HintFrame>{t.rich("hintBeforeAdded", bookLink(hint.book))}</HintFrame>;
    case "beforeMissing":
      return <HintFrame>{t("hintBeforeMissing", { number: hint.number })}</HintFrame>;
    case "completed":
      return <HintFrame>{t("hintCompleted")}</HintFrame>;
    case "current":
      return <HintFrame>{t("hintCurrent")}</HintFrame>;
    case "none":
      return null;
    default:
      return assertNever(hint);
  }
}

function MissingSlot({
  connector,
  number,
  seriesId,
}: {
  connector: ConnectorTone;
  number: number;
  seriesId: string;
}) {
  const t = useTranslations("books.details.seriesSequence");
  return (
    <li className="group/slot relative flex w-32 shrink-0 flex-col items-center gap-2">
      <div className="relative w-full">
        <Connector tone={connector} />
        <SlotFrame badge={<NumberBadge>{number}</NumberBadge>} tone="placeholder">
          <PlaceholderCover icon="book" />
        </SlotFrame>
      </div>
      <p className={cn("line-clamp-2 w-full text-center text-xs text-muted-foreground", SLOT_FADE)}>
        {t("slotTitleFallback", { number })}
      </p>
      <Button asChild className={SLOT_FADE} size="xs" variant="secondary">
        <Link
          aria-label={t("addBookAria", { number })}
          href={`/books/new?seriesId=${seriesId}&partNumber=${number}`}
        >
          {t("addBook")}
        </Link>
      </Button>
    </li>
  );
}

function NumberBadge({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="absolute -top-3 -left-3 z-20 flex size-6 items-center justify-center rounded-full bg-brand pb-[3px] font-heading text-[0.8125rem] font-bold text-primary-foreground tabular-nums shadow-[0_0_0_3px_var(--card)]"
    >
      {children}
    </span>
  );
}

function OpenSlot({
  connector,
  partNumber,
  seriesId,
}: {
  connector: ConnectorTone;
  partNumber: number;
  seriesId: string;
}) {
  const t = useTranslations("books.details.seriesSequence");
  return (
    <li className="group/slot relative flex w-32 shrink-0 flex-col items-center gap-2">
      <div className="relative w-full">
        <Connector tone={connector} />
        <SlotFrame tone="placeholder">
          <PlaceholderCover dashed icon="plus" />
        </SlotFrame>
      </div>
      <p className={cn("line-clamp-2 w-full text-center text-xs text-muted-foreground", SLOT_FADE)}>
        {t("openSlot")}
      </p>
      <Button asChild className={SLOT_FADE} size="xs" variant="secondary">
        <Link
          aria-label={t("openSlotAria")}
          href={`/books/new?seriesId=${seriesId}&partNumber=${partNumber}`}
        >
          {t("addBook")}
        </Link>
      </Button>
    </li>
  );
}

function PlaceholderCover({ dashed = false, icon }: { dashed?: boolean; icon: "book" | "plus" }) {
  return (
    <div
      className={cn(
        "grid aspect-[2/3] w-full place-items-center rounded-md border bg-card/50 text-muted-foreground",
        dashed ? "border-dashed border-accent-border" : "border-accent-border",
      )}
    >
      <UiIcon aria-hidden name={icon} size={26} />
    </div>
  );
}

function ReadingChip({ className, status }: { className?: string; status: ReadingStatus }) {
  const tReading = useTranslations("books.readingStatus.options");
  if (status === "not_started") return null;
  const entry = readingStatuses.find((item) => item.value === status);
  if (entry === undefined) return null;
  return (
    <StatusBadge
      className={cn("max-w-full", className)}
      entry={{ ...entry, label: tReading(status) }}
    />
  );
}

function RibbonSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden px-2 pt-3 pb-2">
      {SKELETON_SLOTS.map((key) => (
        <div className="flex w-32 shrink-0 flex-col items-center gap-2" key={key}>
          <Skeleton className="aspect-[3/4] w-full rounded-md" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function SeriesReadingProgress({ finished, total }: { finished: number; total: number }) {
  const t = useTranslations("books.details.seriesSequence");
  const percent = Math.round((finished / total) * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <Progress className="h-1.5" value={percent} />
      <p className="text-sm text-muted-foreground tabular-nums">
        {t("readingProgressLabel", { finished, percent, total })}
      </p>
    </div>
  );
}

function SeriesSequence({ book, series }: { book: BookView; series: SeriesView }) {
  const t = useTranslations("books.details.seriesSequence");
  const { data, isPending } = useSeriesDetails(series.id);
  const scrollRef = useRef<HTMLOListElement>(null);

  const books = data?.books ?? [];
  const slots =
    data === undefined
      ? []
      : buildSeriesSlots({ books, currentId: book.id, totalBooks: series.totalBooks });

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (container === null) return;
    if (container.scrollWidth <= container.clientWidth) return;
    const current = container.querySelector<HTMLElement>("[data-current='true']");
    if (current === null) return;
    container.scrollLeft = Math.max(
      0,
      current.offsetLeft - (container.clientWidth - current.clientWidth) / 2,
    );
  }, [data]);

  const missingCount = slots.filter((slot) => slot.kind === "missing").length;

  return (
    <FormSection
      action={
        <Button asChild size="sm" variant="secondary">
          <Link href={`/series/${series.id}`}>
            {t("goToSeries")}
            <UiIcon name="arrow-right" size={14} />
          </Link>
        </Button>
      }
      icon="list"
      title={
        <span className="relative inline-flex items-center">
          {t("title")}
          <Image
            alt=""
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-full ml-2 -translate-y-1/2 select-none"
            height={40}
            src="/illustrations/leaf-1.png"
            unoptimized
            width={48}
          />
        </span>
      }
    >
      <SeriesSummaryHeader series={series} />
      {isPending ? <RibbonSkeleton /> : null}
      {isPending || data === undefined ? null : (
        <>
          <ol
            aria-label={t("ribbonLabel")}
            className="relative flex gap-4 overflow-x-auto px-4 pt-5 pb-4"
            ref={scrollRef}
          >
            {slots.map((slot, index) => (
              <SlotView
                connector={connectorTone(index === 0 ? null : (slots[index - 1] ?? null), slot)}
                key={slot.key}
                seriesId={series.id}
                slot={slot}
              />
            ))}
          </ol>
          <HintLine
            hint={computeSeriesSequenceHint({
              books,
              currentId: book.id,
              currentPartNumber: book.partNumber,
              totalBooks: series.totalBooks,
            })}
          />
          {missingCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("footerNote", { added: series.booksInSeries, remaining: missingCount })}
            </p>
          ) : null}
        </>
      )}
    </FormSection>
  );
}

function SeriesSummaryHeader({ series }: { series: SeriesView }) {
  const t = useTranslations("books.details.seriesSequence");
  const { totalBooks } = series;
  const seriesRead =
    totalBooks !== null && totalBooks > 0 && series.finishedInSeries === totalBooks;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          className="font-heading font-medium text-ink no-underline transition-colors outline-none hover:text-primary hover:underline focus-visible:text-primary"
          href={`/series/${series.id}`}
        >
          {series.name}
        </Link>
        {series.status === "completed" ? (
          <StatusBadge
            entry={{
              icon: "check-circle",
              label: t("cycleCompleteBadge"),
              tone: "success",
              value: "cycle-complete",
            }}
          />
        ) : null}
        {seriesRead ? (
          <StatusBadge
            entry={{
              icon: "check-circle",
              label: t("seriesReadBadge"),
              tone: "success",
              value: "series-read",
            }}
          />
        ) : null}
      </div>

      {totalBooks === null ? null : (
        <SeriesReadingProgress finished={series.finishedInSeries} total={totalBooks} />
      )}

      <p className="text-sm text-muted-foreground">
        {totalBooks === null
          ? t("metaLibrary", { added: series.booksInSeries })
          : t("metaLibraryWithTotal", { added: series.booksInSeries, total: totalBooks })}
      </p>
    </div>
  );
}

function SlotFrame({
  badge,
  children,
  isCurrent = false,
  tone,
}: {
  badge?: ReactNode;
  children: ReactNode;
  isCurrent?: boolean;
  tone: "added" | "placeholder";
}) {
  return (
    <div
      className={cn(
        "relative w-full rounded-lg p-2.5 motion-safe:transition motion-safe:duration-200 motion-safe:ease-out",
        tone === "added" ? "bg-card" : "bg-field",
        isCurrent
          ? "border-2 border-brand shadow-btn"
          : cn(
              "border-[1.5px] border-accent-border",
              "opacity-[0.72] group-focus-within/slot:opacity-100 group-hover/slot:opacity-100",
              "group-hover/slot:shadow-hover motion-safe:group-hover/slot:-translate-y-0.5",
              tone === "added"
                ? "group-hover/slot:border-brand"
                : "group-hover/slot:border-accent-border group-hover/slot:bg-accent",
            ),
      )}
    >
      {children}
      {badge}
    </div>
  );
}

function SlotView({
  connector,
  seriesId,
  slot,
}: {
  connector: ConnectorTone;
  seriesId: string;
  slot: SeriesSlot;
}) {
  switch (slot.kind) {
    case "added":
      return (
        <AddedSlot
          book={slot.book}
          connector={connector}
          isCurrent={slot.isCurrent}
          number={slot.number}
        />
      );
    case "missing":
      return <MissingSlot connector={connector} number={slot.number} seriesId={seriesId} />;
    case "open":
      return <OpenSlot connector={connector} partNumber={slot.partNumber} seriesId={seriesId} />;
    default:
      return assertNever(slot);
  }
}
