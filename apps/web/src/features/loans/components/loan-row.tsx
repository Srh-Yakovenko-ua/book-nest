"use client";

import type { LoanListItemView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import Image from "next/image";

import { UiIcon } from "@/components/icons";
import { TooltipHint } from "@/components/tooltip-hint";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import { ownershipStatuses } from "@/lib/book-status";

import type { LoanRelative } from "../model/loans-derive";

import { formatLoanDate, loanRelative } from "../model/loans-derive";
import { LoanActionsMenu } from "./loan-actions-menu";
import { LoanStatusBadge } from "./loan-status-badge";

type LoanRowProps = {
  loan: LoanListItemView;
  onEdit: () => void;
  onReturn: () => void;
  today: string;
};

type RelativeBadge = {
  days?: number;
  key: "overdue" | "soon" | "today";
  tone: "error" | "warning";
};

export function LoanRow({ loan, onEdit, onReturn, today }: LoanRowProps) {
  const tRow = useTranslations("loans.row");
  const tRelative = useTranslations("loans.relative");
  const tOwnership = useTranslations("books.ownershipStatus.options");

  const isBorrowed = loan.type === "borrowed_from_someone";
  const loanDate = formatLoanDate(loan.loanDate);
  const returnDate = formatLoanDate(loan.expectedReturnDate);
  const relative = resolveRelativeBadge(
    loan.loanUiStatus,
    loanRelative(loan.expectedReturnDate, today),
  );
  const ownership = ownershipStatuses.find((entry) => entry.value === loan.book.ownershipStatus);

  return (
    <article className="flex gap-4 rounded-xl border border-border bg-card p-4 shadow-card transition-[box-shadow,border-color] duration-200 ease-out hover:border-accent-border hover:shadow-hover motion-reduce:transition-none">
      <LoanCover alt={loan.book.title} src={loan.book.cover?.urls.thumb} />

      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link className="group/title inline-block max-w-full" href={`/books/${loan.book.id}`}>
              <h3 className="truncate font-heading text-sm leading-tight font-bold text-ink transition-colors group-hover/title:text-primary">
                {loan.book.title}
              </h3>
            </Link>
            <p className="truncate text-xs text-muted-foreground">{loan.book.firstAuthorName}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {loan.remindToReturn ? (
              <TooltipHint label={tRow("reminderOn")}>
                <UiIcon
                  aria-label={tRow("reminderOn")}
                  className="text-warning"
                  name="bell"
                  size={16}
                />
              </TooltipHint>
            ) : null}
            <LoanActionsMenu loan={loan} onEdit={onEdit} onReturn={onReturn} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <LoanStatusBadge status={loan.loanUiStatus} />
          {ownership ? (
            <StatusBadge entry={{ ...ownership, label: tOwnership(loan.book.ownershipStatus) }} />
          ) : null}
          {relative ? (
            <span
              className={
                relative.tone === "error"
                  ? "text-xs font-medium text-error"
                  : "text-xs font-medium text-warning"
              }
            >
              {relative.days === undefined
                ? tRelative(relative.key)
                : tRelative(relative.key, { days: relative.days })}
            </span>
          ) : null}
        </div>

        <dl className="flex flex-col gap-1 text-xs sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-1">
          <InfoLine label={isBorrowed ? tRow("personBorrowed") : tRow("personLent")}>
            {loan.personName}
          </InfoLine>
          {loan.contact ? <InfoLine label={tRow("contact")}>{loan.contact}</InfoLine> : null}
          {loanDate ? (
            <InfoLine label={isBorrowed ? tRow("loanDateBorrowed") : tRow("loanDateLent")}>
              {loanDate}
            </InfoLine>
          ) : null}
          {returnDate ? (
            <InfoLine label={isBorrowed ? tRow("returnDateBorrowed") : tRow("returnDateLent")}>
              {returnDate}
            </InfoLine>
          ) : null}
        </dl>

        {loan.note ? (
          <p className="line-clamp-2 rounded-md bg-secondary/60 px-2.5 py-1.5 text-xs text-foreground/85">
            <span className="font-medium text-muted-foreground">{tRow("note")}: </span>
            {loan.note}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function InfoLine({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium text-foreground/90">{children}</dd>
    </div>
  );
}

function LoanCover({ alt, src }: { alt: string; src?: string }) {
  if (src === undefined) {
    return (
      <div className="grid aspect-[3/4] w-16 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground/70">
        <UiIcon name="book" size={22} />
      </div>
    );
  }

  return (
    <div className="relative aspect-[3/4] w-16 shrink-0 overflow-hidden rounded-md bg-accent">
      <Image alt={alt} className="object-cover" fill sizes="64px" src={src} unoptimized />
    </div>
  );
}

function resolveRelativeBadge(
  status: LoanListItemView["loanUiStatus"],
  relative: LoanRelative,
): null | RelativeBadge {
  if (status === "overdue" && relative.kind === "overdue") {
    return { days: relative.days, key: "overdue", tone: "error" };
  }
  if (status === "return_soon" && relative.kind === "today") {
    return { key: "today", tone: "warning" };
  }
  if (status === "return_soon" && relative.kind === "soon") {
    return { days: relative.days, key: "soon", tone: "warning" };
  }
  return null;
}
