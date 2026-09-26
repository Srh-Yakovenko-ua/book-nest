"use client";

import type { ReactNode } from "react";

import { useLocale } from "next-intl";

import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type TimelineOverviewCardProps = {
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  title: string;
};

type TimelineOverviewRowProps = {
  barColor?: string;
  count: number;
  icon?: ReactNode;
  label: string;
  max: number;
  onSelect?: () => void;
};

export function TimelineOverviewCard({
  action,
  children,
  footer,
  title,
}: TimelineOverviewCardProps) {
  return (
    <Card className="h-full gap-3">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {action === undefined ? null : <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className="flex min-h-46 flex-1 flex-col gap-2">{children}</CardContent>
      {footer === undefined ? null : <CardFooter className="p-0">{footer}</CardFooter>}
    </Card>
  );
}

export function TimelineOverviewRow({
  barColor,
  count,
  icon,
  label,
  max,
  onSelect,
}: TimelineOverviewRowProps) {
  const locale = useLocale();
  const width = max > 0 ? (count / max) * 100 : 0;

  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-sm text-foreground">
          {icon}
          <span className="truncate">{label}</span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-ink tabular-nums">
          {formatNumber(count, locale)}
        </span>
      </div>
      <div aria-hidden className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none",
            barColor === undefined && "bg-primary",
          )}
          style={{ backgroundColor: barColor, width: `${width}%` }}
        />
      </div>
    </>
  );

  if (onSelect === undefined) {
    return <div className="flex flex-col gap-1.5 p-1">{content}</div>;
  }

  return (
    <button
      className="flex cursor-pointer flex-col gap-1.5 rounded-md p-1 text-left transition-colors outline-none hover:bg-secondary/60 focus-visible:ring-3 focus-visible:ring-ring/50"
      onClick={onSelect}
      type="button"
    >
      {content}
    </button>
  );
}
