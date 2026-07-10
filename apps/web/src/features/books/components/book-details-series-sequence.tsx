"use client";

import type { BookView, ReadingStatus, SeriesBookView, SeriesView } from "@app/shared";

import { useTranslations } from "next-intl";
import { type ReactNode, useLayoutEffect, useRef } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { readingOrder, suggestedPartNumber, useSeriesDetails } from "@/features/series";
import { Link } from "@/i18n/navigation";
import { readingStatuses } from "@/lib/book-status";
import { cn } from "@/lib/utils";

import { FormSection } from "./form-section";

type ConnectorTone = "none" | "pale" | "strong";

type Hint =
  | { book: SeriesBookView; kind: "startAdded" }
  | { kind: "completed" }
  | { kind: "nextMissing"; number: number }
  | { kind: "none" };

type Slot =
  | { book: SeriesBookView; isCurrent: boolean; key: string; kind: "added"; number: null | number }
  | { key: string; kind: "missing"; number: number }
  | { key: string; kind: "open"; partNumber: number };

const SKELETON_SLOTS = ["s1", "s2", "s3", "s4", "s5"] as const;

export function BookDetailsSeriesSequence({ book }: { book: BookView }) {
  if (book.series === null) return null;
  return <SeriesSequence book={book} series={book.series} />;
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
        <div
          className={cn(
            "grid aspect-[3/4] w-full place-items-center rounded-md bg-accent text-accent-foreground/70 shadow-soft",
            isCurrent && "border-2 border-brand",
          )}
        >
          <UiIcon aria-hidden name="book" size={26} />
        </div>
        <NumberBadge tone="brand">{number === null ? t("noNumberBadge") : number}</NumberBadge>
      </div>
      <p className="line-clamp-2 w-full text-center text-xs font-medium text-foreground/90">
        {book.title}
      </p>
      <ReadingChip status={book.readingStatus} />
    </>
  );

  if (isCurrent) {
    return (
      <li
        aria-current="true"
        className="relative flex w-32 shrink-0 flex-col items-center"
        data-current="true"
      >
        <div className="flex h-5 items-center justify-center">
          <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-white">
            {t("current")}
          </span>
        </div>
        <div className="flex w-full flex-col items-center gap-2">{body}</div>
      </li>
    );
  }

  return (
    <li className="relative flex w-32 shrink-0 flex-col items-center">
      <div className="h-5" />
      <Link
        className="flex w-full flex-col items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&_p]:transition-colors hover:[&_p]:text-primary"
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

function buildSlots(series: SeriesView, books: SeriesBookView[], currentId: string): Slot[] {
  const total = series.totalBooks;

  if (total === null) {
    const numbered = readingOrder(books).map((entry) => toAddedSlot(entry, currentId));
    const unnumbered = books
      .filter((entry) => entry.partNumber === null)
      .map((entry) => toAddedSlot(entry, currentId));
    return [
      ...numbered,
      ...unnumbered,
      { key: "open", kind: "open", partNumber: suggestedPartNumber(books) },
    ];
  }

  const used = new Set<string>();
  const slots: Slot[] = [];
  for (let position = 1; position <= total; position += 1) {
    const matches = books.filter((entry) => entry.partNumber === position);
    if (matches.length === 0) {
      slots.push({ key: `missing-${position}`, kind: "missing", number: position });
      continue;
    }
    for (const match of matches) {
      slots.push(toAddedSlot(match, currentId));
      used.add(match.id);
    }
  }

  const extras = books
    .filter((entry) => !used.has(entry.id))
    .sort(
      (a, b) =>
        (a.partNumber ?? Number.MAX_SAFE_INTEGER) - (b.partNumber ?? Number.MAX_SAFE_INTEGER),
    );
  for (const extra of extras) slots.push(toAddedSlot(extra, currentId));
  return slots;
}

function computeHint(series: SeriesView, books: SeriesBookView[]): Hint {
  const total = series.totalBooks;

  if (total === null) {
    const next = readingOrder(books).find((entry) => entry.readingStatus !== "finished");
    return next === undefined ? { kind: "none" } : { book: next, kind: "startAdded" };
  }

  for (let position = 1; position <= total; position += 1) {
    const added = books.find((entry) => entry.partNumber === position);
    if (added === undefined) return { kind: "nextMissing", number: position };
    if (added.readingStatus !== "finished") return { book: added, kind: "startAdded" };
  }
  return { kind: "completed" };
}

function Connector({ tone }: { tone: ConnectorTone }) {
  if (tone === "none") return null;
  return (
    <span
      aria-hidden
      className={cn(
        "absolute top-1/2 -left-4 h-0.5 w-4 -translate-y-1/2 rounded-full",
        tone === "strong" ? "bg-brand" : "bg-border",
      )}
    />
  );
}

function connectorTone(previous: null | Slot, current: Slot): ConnectorTone {
  if (previous === null) return "none";
  if (previous.kind !== "added" || current.kind !== "added") return "pale";
  if (previous.number !== null && current.number !== null && previous.number === current.number) {
    return "none";
  }
  return "strong";
}

function HintFrame({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
      <UiIcon aria-hidden className="mt-0.5 shrink-0 text-icon" name="arrow-right" size={15} />
      <span>{children}</span>
    </p>
  );
}

function HintLine({ hint, seriesId }: { hint: Hint; seriesId: string }) {
  const t = useTranslations("books.details.seriesSequence");

  if (hint.kind === "completed") {
    return <HintFrame>{t("hintCompleted")}</HintFrame>;
  }

  if (hint.kind === "startAdded") {
    return (
      <HintFrame>
        {t.rich("hintStartAdded", {
          book: (chunks) => (
            <Link
              className="font-medium text-primary hover:underline"
              href={`/books/${hint.book.id}`}
            >
              {chunks}
            </Link>
          ),
          title: hint.book.title,
        })}
      </HintFrame>
    );
  }

  if (hint.kind === "nextMissing") {
    return (
      <HintFrame>
        {t("hintNextMissing", { title: t("slotTitleFallback", { number: hint.number }) })}{" "}
        <Link
          className="font-medium text-primary hover:underline"
          href={`/books/new?seriesId=${seriesId}&partNumber=${hint.number}`}
        >
          {t("addBook")}
        </Link>
      </HintFrame>
    );
  }

  return null;
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
    <li className="relative flex w-32 shrink-0 flex-col items-center">
      <div className="h-5" />
      <div className="flex w-full flex-col items-center gap-2">
        <div className="relative w-full">
          <Connector tone={connector} />
          <PlaceholderCover icon="book" />
          <NumberBadge tone="muted">{number}</NumberBadge>
        </div>
        <p className="line-clamp-2 w-full text-center text-xs text-muted-foreground">
          {t("slotTitleFallback", { number })}
        </p>
        <Button asChild size="xs" variant="secondary">
          <Link
            aria-label={t("addBookAria", { number })}
            href={`/books/new?seriesId=${seriesId}&partNumber=${number}`}
          >
            {t("addBook")}
          </Link>
        </Button>
      </div>
    </li>
  );
}

function NumberBadge({ children, tone }: { children: ReactNode; tone: "brand" | "muted" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute -top-2 -left-2 z-10 grid size-6 place-items-center rounded-full font-heading text-[0.6875rem] font-bold tabular-nums shadow-soft",
        tone === "brand"
          ? "bg-brand text-white"
          : "border border-border bg-field text-muted-foreground",
      )}
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
    <li className="relative flex w-32 shrink-0 flex-col items-center">
      <div className="h-5" />
      <div className="flex w-full flex-col items-center gap-2">
        <div className="relative w-full">
          <Connector tone={connector} />
          <PlaceholderCover dashed icon="plus" />
        </div>
        <p className="line-clamp-2 w-full text-center text-xs text-muted-foreground">
          {t("openSlot")}
        </p>
        <Button asChild size="xs" variant="secondary">
          <Link
            aria-label={t("openSlotAria")}
            href={`/books/new?seriesId=${seriesId}&partNumber=${partNumber}`}
          >
            {t("addBook")}
          </Link>
        </Button>
      </div>
    </li>
  );
}

function PlaceholderCover({ dashed = false, icon }: { dashed?: boolean; icon: "book" | "plus" }) {
  return (
    <div
      className={cn(
        "grid aspect-[3/4] w-full place-items-center rounded-md border bg-field text-muted-foreground",
        dashed ? "border-dashed border-border" : "border-border",
      )}
    >
      <UiIcon aria-hidden name={icon} size={26} />
    </div>
  );
}

function ReadingChip({ status }: { status: ReadingStatus }) {
  const tReading = useTranslations("books.readingStatus.options");
  if (status === "not_started") return null;
  const entry = readingStatuses.find((item) => item.value === status);
  if (entry === undefined) return null;
  return <StatusBadge className="max-w-full" entry={{ ...entry, label: tReading(status) }} />;
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

function SeriesSequence({ book, series }: { book: BookView; series: SeriesView }) {
  const t = useTranslations("books.details.seriesSequence");
  const { data, isPending } = useSeriesDetails(series.id);
  const scrollRef = useRef<HTMLOListElement>(null);

  const books = data?.books ?? [];
  const slots = data === undefined ? [] : buildSlots(series, books, book.id);

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

  const meta: string[] = [];
  if (book.partNumber !== null) {
    meta.push(
      series.totalBooks === null
        ? t("metaBook", { number: book.partNumber })
        : t("metaBookWithTotal", { number: book.partNumber, total: series.totalBooks }),
    );
  }
  meta.push(
    series.totalBooks === null
      ? t("metaLibrary", { added: series.booksInSeries })
      : t("metaLibraryWithTotal", { added: series.booksInSeries, total: series.totalBooks }),
  );

  const hasMissingNumbered = slots.some((slot) => slot.kind === "missing");

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
      description={meta.join(" · ")}
      icon="list"
      title={t("title")}
    >
      {isPending ? <RibbonSkeleton /> : null}
      {isPending || data === undefined ? null : (
        <>
          <ol
            aria-label={t("ribbonLabel")}
            className="relative flex gap-4 overflow-x-auto px-2 pt-3 pb-2"
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
          <HintLine hint={computeHint(series, books)} seriesId={series.id} />
          {hasMissingNumbered ? (
            <p className="text-xs text-muted-foreground">{t("footerNote")}</p>
          ) : null}
        </>
      )}
    </FormSection>
  );
}

function SlotView({
  connector,
  seriesId,
  slot,
}: {
  connector: ConnectorTone;
  seriesId: string;
  slot: Slot;
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

function toAddedSlot(book: SeriesBookView, currentId: string): Slot {
  return {
    book,
    isCurrent: book.id === currentId,
    key: `added-${book.id}`,
    kind: "added",
    number: book.partNumber,
  };
}
