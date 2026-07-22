"use client";

import type { SeriesOrderActionCode, SeriesOrderBookView, SeriesOrderIssueView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";

import {
  hasProblemDescription,
  seriesOrderActionHref,
  seriesOrderActionLabelKey,
  toSeverityStatus,
  visibleSeriesOrderActions,
} from "../model/series-order-check";
import { SeriesOrderBookRow } from "./series-order-book-row";
import { SeriesOrderComparison } from "./series-order-comparison";

type SeriesOrderIssueCardProps = {
  issue: SeriesOrderIssueView;
  onAction: (code: SeriesOrderActionCode) => void;
  pending: boolean;
};

const bookTitleTag = (chunks: ReactNode) => <span className="font-semibold">{chunks}</span>;

export function SeriesOrderIssueCard({ issue, onAction, pending }: SeriesOrderIssueCardProps) {
  const t = useTranslations("readingQueue.seriesOrderCheck");
  const tActions = useTranslations("readingQueue.seriesOrderCheck.actions");
  const tCard = useTranslations("readingQueue.seriesOrderCheck.card");

  const textParams = {
    affectedBook: issue.affectedBook.title,
    b: bookTitleTag,
    count: issue.unresolvedPreviousCount,
    previousBook: issue.previousBook?.title ?? "",
  };
  const actions = visibleSeriesOrderActions(issue);
  const [primary, ...secondary] = actions;
  const canIgnore = issue.allowedActions.includes("IGNORE_ISSUE");
  const canDisable = issue.allowedActions.includes("DISABLE_SERIES_CHECK");

  const books: { book: SeriesOrderBookView; label?: string }[] =
    issue.previousBook === null
      ? [{ book: issue.affectedBook }]
      : [
          { book: issue.affectedBook, label: tCard("affectedBook") },
          { book: issue.previousBook, label: tCard("previousBook") },
        ];

  return (
    <Card className="@container/issue-card relative gap-4 p-4">
      {canDisable ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={tCard("moreActions", { series: issue.series.title })}
              className="absolute top-3 right-3 z-10"
              size="icon-sm"
              variant="ghost"
            >
              <UiIcon name="more" size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto">
            <DropdownMenuItem onSelect={() => onAction("DISABLE_SERIES_CHECK")}>
              <UiIcon name="circle-slash" size={16} />
              {tActions("disableSeries")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 @2xl/issue-card:grid-cols-[3fr_2fr]">
        <div className="flex flex-col items-start gap-2">
          <StatusBadge entry={toSeverityStatus(issue.severity, t(`severity.${issue.severity}`))} />
          <div className="flex flex-col gap-1">
            <Link
              className="truncate font-heading text-sm font-semibold text-ink no-underline transition-colors hover:text-primary"
              href={`/series/${issue.series.id}`}
            >
              {issue.series.title}
            </Link>
            <p className="text-sm leading-snug text-foreground">
              {t.rich(`problems.${issue.problemType}.title`, textParams)}
            </p>
            {hasProblemDescription(issue.problemType) ? (
              <p className="text-xs leading-snug text-muted-foreground">
                {t.rich(`problems.${issue.problemType}.description`, textParams)}
              </p>
            ) : null}
            {issue.relatedProblems.length === 0 ? null : (
              <p className="text-xs text-muted-foreground">
                {tCard("relatedProblems", { count: issue.relatedProblems.length })}
              </p>
            )}
          </div>
          <div className="w-full">
            <SeriesOrderComparison
              currentOrder={issue.currentOrder}
              recommendedOrder={issue.recommendedOrder}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2.5 rounded-md border border-border bg-secondary/40 p-2.5">
          <p className="text-xs font-medium text-muted-foreground @2xl/issue-card:pr-8">
            {books.length > 1 ? tCard("affectedBooks") : tCard("affectedBook")}
          </p>
          {books.map(({ book, label }) => (
            <SeriesOrderBookRow book={book} key={book.id} label={label} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 @2xl/issue-card:flex-row @2xl/issue-card:flex-wrap @2xl/issue-card:items-center @2xl/issue-card:justify-center">
        {primary === undefined ? null : (
          <IssueAction
            code={primary}
            issue={issue}
            label={tActions(seriesOrderActionLabelKey(primary, issue.problemType))}
            onAction={onAction}
            pending={pending}
            variant="default"
          />
        )}
        {secondary.map((code) => (
          <IssueAction
            code={code}
            issue={issue}
            key={code}
            label={tActions(seriesOrderActionLabelKey(code, issue.problemType))}
            onAction={onAction}
            pending={pending}
            variant="secondary"
          />
        ))}
        {canIgnore ? (
          <IssueAction
            code="IGNORE_ISSUE"
            issue={issue}
            label={tActions("ignore")}
            onAction={onAction}
            pending={pending}
            variant="ghost"
          />
        ) : null}
      </div>
    </Card>
  );
}

function IssueAction({
  code,
  issue,
  label,
  onAction,
  pending,
  variant,
}: {
  code: SeriesOrderActionCode;
  issue: SeriesOrderIssueView;
  label: string;
  onAction: (code: SeriesOrderActionCode) => void;
  pending: boolean;
  variant: "default" | "ghost" | "secondary";
}) {
  const href = seriesOrderActionHref(code, issue);
  const className = "h-auto min-h-7 w-full py-1 @2xl/issue-card:w-auto";
  const text = <span className="line-clamp-2 min-w-0 break-words whitespace-normal">{label}</span>;

  if (href !== null) {
    return (
      <Button asChild className={className} size="sm" variant={variant}>
        <Link href={href}>{text}</Link>
      </Button>
    );
  }

  return (
    <Button
      className={className}
      disabled={pending}
      onClick={() => onAction(code)}
      size="sm"
      variant={variant}
    >
      {text}
    </Button>
  );
}
