"use client";

import type { LoanHistoryListItemView, LoanHistoryResult } from "@app/shared";

import { useTranslations } from "next-intl";
import Image from "next/image";

import type { UiIconName } from "@/components/icons";

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
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { formatLoanDate } from "../../model/loans-derive";

type LoanHistoryRowProps = {
  loan: LoanHistoryListItemView;
  onCorrectDate: () => void;
  onEditNote: () => void;
  onOpenDetails: () => void;
};

type TimelineNode = {
  icon: UiIconName;
  label: string;
  value: string;
};

const RESULT_LOOK = {
  late: { icon: "clock", surfaceClass: "bg-warning-soft", toneClass: "text-warning" },
  no_due_date: {
    icon: "circle-slash",
    surfaceClass: "bg-secondary",
    toneClass: "text-muted-foreground",
  },
  on_time: { icon: "check-circle", surfaceClass: "bg-success-soft", toneClass: "text-success" },
} as const satisfies Record<
  LoanHistoryResult,
  { icon: UiIconName; surfaceClass: string; toneClass: string }
>;

export function LoanHistoryRow({
  loan,
  onCorrectDate,
  onEditNote,
  onOpenDetails,
}: LoanHistoryRowProps) {
  const t = useTranslations("loans.history");
  const tDirection = useTranslations("loans.history.direction");

  const isBorrowed = loan.type === "borrowed_from_someone";
  const bookHref = `/books/${loan.book.id}`;
  const titleId = `loan-history-title-${loan.id}`;

  return (
    <article className="group/history-row @container/history-row relative flex items-stretch gap-3 rounded-xl border border-border bg-card p-3 shadow-card transition-[box-shadow,border-color] duration-200 ease-out hover:border-accent-border hover:shadow-hover motion-reduce:transition-none sm:gap-3.5">
      <Link
        className="relative z-10 aspect-[2/3] w-16 shrink-0 self-start overflow-hidden rounded-lg bg-accent outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-20"
        href={bookHref}
        tabIndex={-1}
      >
        {loan.book.cover === null ? (
          <span className="grid h-full w-full place-items-center text-accent-foreground/70">
            <UiIcon name="book" size={24} />
          </span>
        ) : (
          <Image
            alt={loan.book.title}
            className="object-cover"
            fill
            sizes="80px"
            src={loan.book.cover.urls.card}
            unoptimized
          />
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-3 @3xl/history-row:flex-row @3xl/history-row:items-stretch @3xl/history-row:gap-4">
        <div className="flex min-w-0 flex-col gap-1.5 @3xl/history-row:w-56 @3xl/history-row:shrink-0">
          <h3
            className="line-clamp-2 font-heading text-sm leading-tight font-bold text-ink"
            id={titleId}
          >
            <Link
              className="relative z-10 rounded-sm text-ink no-underline transition-colors outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
              href={bookHref}
            >
              {loan.book.title}
            </Link>
          </h3>

          {loan.book.firstAuthorName === "" ? null : (
            <p className="truncate text-xs text-muted-foreground">{loan.book.firstAuthorName}</p>
          )}

          <Badge variant={isBorrowed ? "info" : "primary"}>{tDirection(loan.type)}</Badge>

          <p className="flex min-w-0 items-baseline gap-1.5 text-xs">
            <span className="shrink-0 text-muted-foreground">
              {t(isBorrowed ? "row.personBorrowed" : "row.personLent")}
            </span>
            <span className="truncate font-medium text-foreground/90">{loan.personName}</span>
          </p>
        </div>

        <div className="hidden w-px self-stretch bg-border @3xl/history-row:block" />

        <LoanHistoryTimeline loan={loan} />

        <div className="hidden w-px self-stretch bg-border @3xl/history-row:block" />

        <LoanHistoryOutcome loan={loan} />
      </div>

      <div className="relative z-10 shrink-0 self-start">
        <LoanHistoryActionsMenu
          bookHref={bookHref}
          onCorrectDate={onCorrectDate}
          onEditNote={onEditNote}
          onOpenDetails={onOpenDetails}
        />
      </div>

      <button
        aria-describedby={titleId}
        aria-label={t("row.openDetails")}
        className="absolute inset-0 cursor-pointer rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        data-loan-trigger={loan.id}
        onClick={onOpenDetails}
        type="button"
      />
    </article>
  );
}

function LoanHistoryActionsMenu({
  bookHref,
  onCorrectDate,
  onEditNote,
  onOpenDetails,
}: {
  bookHref: string;
  onCorrectDate: () => void;
  onEditNote: () => void;
  onOpenDetails: () => void;
}) {
  const t = useTranslations("loans.history.actions");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={t("menu")} size="icon" variant="ghost">
          <UiIcon name="more" size={18} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onSelect={onOpenDetails}>
          <UiIcon name="info" size={16} />
          {t("details")}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={bookHref}>
            <UiIcon name="book" size={16} />
            {t("openBook")}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={onCorrectDate}>
          <UiIcon name="calendar" size={16} />
          {t("correctDate")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onEditNote}>
          <UiIcon name="note" size={16} />
          {t("editNote")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LoanHistoryOutcome({ loan }: { loan: LoanHistoryListItemView }) {
  const t = useTranslations("loans.history");
  const look = RESULT_LOOK[loan.historyResult];

  const result =
    loan.historyResult === "late"
      ? t("result.late", { count: loan.delayDays ?? 0 })
      : t(`result.${loan.historyResult}`);

  const duration =
    loan.durationDays === null
      ? t("duration.unknown")
      : t(loan.historyResult === "late" ? "duration.total" : "duration.days", {
          count: loan.durationDays,
        });

  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 self-start rounded-lg px-3 py-2 @3xl/history-row:w-48 @3xl/history-row:shrink-0",
        look.surfaceClass,
      )}
    >
      <p className={cn("flex items-start gap-1.5 text-sm font-semibold", look.toneClass)}>
        <UiIcon aria-hidden className="mt-0.5 shrink-0" name={look.icon} size={16} />
        <span>{result}</span>
      </p>
      <p className="pl-[1.375rem] text-xs text-muted-foreground tabular-nums">{duration}</p>
    </div>
  );
}

function LoanHistoryTimeline({ loan }: { loan: LoanHistoryListItemView }) {
  const t = useTranslations("loans.history.timeline");

  const nodes: TimelineNode[] = [
    {
      icon: "clock",
      label: t(loan.type === "borrowed_from_someone" ? "loanDateBorrowed" : "loanDateLent"),
      value: formatLoanDate(loan.loanDate) ?? t("unknownDate"),
    },
    {
      icon: "calendar",
      label: t("expected"),
      value: formatLoanDate(loan.expectedReturnDate) ?? t("expectedNone"),
    },
    {
      icon: "check-circle",
      label: t("returned"),
      value: formatLoanDate(loan.returnedDate) ?? t("unknownDate"),
    },
  ];

  return (
    <ol className="flex min-w-0 flex-1 flex-col gap-2 @5xl/history-row:flex-row @5xl/history-row:items-start @5xl/history-row:gap-1">
      {nodes.map((node, index) => (
        <li
          className="flex min-w-0 items-start gap-1.5 @5xl/history-row:flex-1 @5xl/history-row:basis-0"
          key={node.label}
        >
          {index === 0 ? null : (
            <UiIcon
              aria-hidden
              className="mt-1 hidden shrink-0 text-muted-foreground/50 @5xl/history-row:block"
              name="arrow-right"
              size={14}
            />
          )}
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-start gap-1.5 text-sm font-medium text-foreground tabular-nums">
              <UiIcon
                aria-hidden
                className="mt-0.5 shrink-0 text-icon"
                name={node.icon}
                size={14}
              />
              <span>{node.value}</span>
            </span>
            <span className="pl-5 text-xs text-muted-foreground">{node.label}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
