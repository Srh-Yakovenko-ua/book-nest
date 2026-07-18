"use client";

import type { SeriesOrderActionCode, SeriesOrderIssueView } from "@app/shared";

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
import { SeriesOrderSequence } from "./series-order-sequence";

type SeriesOrderIssueCardProps = {
  issue: SeriesOrderIssueView;
  onAction: (code: SeriesOrderActionCode) => void;
  pending: boolean;
};

export function SeriesOrderIssueCard({ issue, onAction, pending }: SeriesOrderIssueCardProps) {
  const t = useTranslations("readingQueue.seriesOrderCheck");
  const tActions = useTranslations("readingQueue.seriesOrderCheck.actions");
  const tCard = useTranslations("readingQueue.seriesOrderCheck.card");
  const tPreview = useTranslations("readingQueue.seriesOrderCheck.preview");

  const textParams = {
    affectedBook: issue.affectedBook.title,
    count: issue.unresolvedPreviousCount,
    previousBook: issue.previousBook?.title ?? "",
  };
  const actions = visibleSeriesOrderActions(issue);
  const [primary, ...secondary] = actions;
  const canIgnore = issue.allowedActions.includes("IGNORE_ISSUE");
  const canDisable = issue.allowedActions.includes("DISABLE_SERIES_CHECK");

  return (
    <Card className="gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <StatusBadge entry={toSeverityStatus(issue.severity, t(`severity.${issue.severity}`))} />
        {canDisable ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={tCard("moreActions", { series: issue.series.title })}
                size="icon-sm"
                variant="ghost"
              >
                <UiIcon name="more" size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onAction("DISABLE_SERIES_CHECK")}>
                <UiIcon name="circle-slash" size={16} />
                {tActions("disableSeries")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <Link
          className="truncate font-heading text-sm font-semibold text-ink no-underline transition-colors hover:text-primary"
          href={`/series/${issue.series.id}`}
          title={issue.series.title}
        >
          {issue.series.title}
        </Link>
        <p className="text-sm leading-snug text-foreground">
          {t(`problems.${issue.problemType}.title`, textParams)}
        </p>
        {hasProblemDescription(issue.problemType) ? (
          <p className="text-xs leading-snug text-muted-foreground">
            {t(`problems.${issue.problemType}.description`, textParams)}
          </p>
        ) : null}
        {issue.relatedProblems.length === 0 ? null : (
          <p className="text-xs text-muted-foreground">
            {tCard("relatedProblems", { count: issue.relatedProblems.length })}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2.5 rounded-md border border-border bg-secondary/40 p-2.5">
        <SeriesOrderBookRow book={issue.affectedBook} label={tCard("affectedBook")} />
        {issue.previousBook === null ? null : (
          <SeriesOrderBookRow book={issue.previousBook} label={tCard("previousBook")} />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <SeriesOrderSequence items={issue.currentOrder} label={tPreview("current")} />
        <SeriesOrderSequence items={issue.recommendedOrder} label={tPreview("recommended")} />
      </div>

      <div className="flex flex-col gap-2">
        {primary === undefined ? null : (
          <IssueAction
            code={primary}
            issue={issue}
            label={tActions(seriesOrderActionLabelKey(primary, issue.problemType), textParams)}
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
            label={tActions(seriesOrderActionLabelKey(code, issue.problemType), textParams)}
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
  const className = "h-auto min-h-7 w-full py-1";
  const text = <span className="line-clamp-2 min-w-0 break-words whitespace-normal">{label}</span>;

  if (href !== null) {
    return (
      <Button asChild className={className} size="sm" title={label} variant={variant}>
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
      title={label}
      variant={variant}
    >
      {text}
    </Button>
  );
}
