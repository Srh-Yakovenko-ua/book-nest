"use client";

import type { LoanListItemView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { TooltipHint } from "@/components/tooltip-hint";
import { BookRow } from "@/features/books/components/book-row";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type { LoanTerm } from "../model/loans-derive";

import { toLoanRowBook } from "../model/loan-library-book";
import { formatLoanDate, loanTerm } from "../model/loans-derive";
import { LoanContactNameButton } from "./contact/loan-contact-name-button";
import { LoanActionsMenu } from "./loan-actions-menu";
import { LoanStatusBadge } from "./loan-status-badge";

const LOAN_TERM_LOOK = {
  inDays: { icon: "calendar", toneClass: "text-foreground" },
  none: { icon: "circle-slash", toneClass: "text-muted-foreground" },
  overdue: { icon: "alert-triangle", toneClass: "text-error" },
  today: { icon: "clock", toneClass: "text-warning" },
  tomorrow: { icon: "clock", toneClass: "text-warning" },
} as const satisfies Record<LoanTerm["kind"], { icon: UiIconName; toneClass: string }>;

type LoanRowProps = {
  loan: LoanListItemView;
  onEdit: () => void;
  onOpenContact: () => void;
  onReturn: () => void;
  today: string;
};

export function LoanRow({ loan, onEdit, onOpenContact, onReturn, today }: LoanRowProps) {
  const tRow = useTranslations("loans.row");

  const isBorrowed = loan.type === "borrowed_from_someone";

  return (
    <BookRow
      book={toLoanRowBook(loan)}
      coverAspect="portrait"
      detailsSlot={
        <LoanPeopleZone isBorrowed={isBorrowed} loan={loan} onOpenContact={onOpenContact} />
      }
      kebab={
        <div className="flex w-[3.25rem] items-center justify-end gap-1">
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
      }
      linkComponent={Link}
      mobileCompact
      note={
        loan.note === null ? undefined : (
          <p className="mt-1 line-clamp-2 rounded-md bg-secondary/60 px-2.5 py-1.5 text-xs text-foreground/85">
            <span className="font-medium text-muted-foreground">{tRow("note")}: </span>
            {loan.note}
          </p>
        )
      }
      rowLink={false}
      statusSlot={<LoanTermZone loan={loan} today={today} />}
    />
  );
}

function InfoLine({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="truncate font-medium text-foreground/90">{children}</span>
    </div>
  );
}

function LoanPeopleZone({
  isBorrowed,
  loan,
  onOpenContact,
}: {
  isBorrowed: boolean;
  loan: LoanListItemView;
  onOpenContact: () => void;
}) {
  const tRow = useTranslations("loans.row");
  const loanDate = formatLoanDate(loan.loanDate);

  return (
    <div className="flex shrink-0 flex-col gap-1 @xl/book-row:w-40">
      <InfoLine label={isBorrowed ? tRow("personBorrowed") : tRow("personLent")}>
        <LoanContactNameButton name={loan.personName} onOpen={onOpenContact} />
      </InfoLine>
      {loan.contact === null ? null : <InfoLine label={tRow("contact")}>{loan.contact}</InfoLine>}
      {loanDate === null ? null : (
        <InfoLine label={isBorrowed ? tRow("loanDateBorrowed") : tRow("loanDateLent")}>
          {loanDate}
        </InfoLine>
      )}
    </div>
  );
}

function LoanTermZone({ loan, today }: { loan: LoanListItemView; today: string }) {
  const tTerm = useTranslations("loans.row.term");

  const term = loanTerm(loan.expectedReturnDate, today);
  const look = LOAN_TERM_LOOK[term.kind];
  const returnDate = formatLoanDate(loan.expectedReturnDate);

  return (
    <div className="flex shrink-0 flex-col gap-1.5 @xl/book-row:w-48">
      <p className={cn("flex items-center gap-1.5 text-sm font-semibold", look.toneClass)}>
        <UiIcon name={look.icon} size={16} />
        {term.kind === "inDays" || term.kind === "overdue"
          ? tTerm(term.kind, { days: term.days })
          : tTerm(term.kind)}
      </p>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <LoanStatusBadge status={loan.loanUiStatus} />
        {returnDate === null ? null : (
          <span className="text-xs text-muted-foreground tabular-nums">{returnDate}</span>
        )}
      </div>
    </div>
  );
}
