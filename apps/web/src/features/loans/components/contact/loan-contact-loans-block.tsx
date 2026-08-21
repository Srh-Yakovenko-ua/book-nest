"use client";

import type { LoanListItemView, LoanType } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { useLoansList } from "../../api/use-loans-list";
import {
  LOAN_CONTACT_PREVIEW,
  toContactLoansHref,
  toContactLoansParams,
} from "../../model/loan-contact-preview";
import { LOAN_PAGES } from "../../model/loan-pages";
import { formatLoanDate } from "../../model/loans-derive";
import { LoanStatusBadge } from "../loan-status-badge";
import { LoanContactPreviewRow, LoanContactPreviewSkeleton } from "./loan-contact-preview-row";

type LoanContactLoansBlockProps = {
  contactId: string;
  onNavigate: () => void;
  type: LoanType;
};

export function LoanContactLoansBlock({ contactId, onNavigate, type }: LoanContactLoansBlockProps) {
  const t = useTranslations("loans.contactDrawer.active");
  const { direction } = LOAN_PAGES[type];
  const loans = useLoansList(toContactLoansParams({ contactId, type }));

  const firstPage = loans.data?.pages[0];
  const items = firstPage?.items ?? [];
  const totalCount = firstPage?.totalCount ?? 0;

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {t(`${direction}.title`)}
      </h3>

      {loans.isPending ? (
        <LoanContactPreviewSkeleton rows={2} />
      ) : (
        <LoansPreview emptyText={t(`${direction}.empty`)} isError={loans.isError} items={items} />
      )}

      {totalCount > LOAN_CONTACT_PREVIEW.limit ? (
        <Button asChild className="self-start" size="sm" variant="ghost">
          <Link href={toContactLoansHref({ contactId, type })} onClick={onNavigate}>
            {t("viewAll")}
            <UiIcon name="arrow-right" size={16} />
          </Link>
        </Button>
      ) : null}
    </section>
  );
}

function LoansPreview({
  emptyText,
  isError,
  items,
}: {
  emptyText: string;
  isError: boolean;
  items: LoanListItemView[];
}) {
  const t = useTranslations("loans.contactDrawer");

  if (isError) {
    return (
      <p className="text-sm text-muted-foreground" role="alert">
        {t("error")}
      </p>
    );
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((loan) => (
        <LoanContactPreviewRow
          book={loan.book}
          key={loan.id}
          meta={
            <>
              <LoanStatusBadge status={loan.loanUiStatus} />
              <span className="tabular-nums">
                {formatLoanDate(loan.expectedReturnDate) ?? t("active.noReturnDate")}
              </span>
            </>
          }
        />
      ))}
    </ul>
  );
}
