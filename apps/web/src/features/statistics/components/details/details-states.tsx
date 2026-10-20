"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { StatisticsSectionState } from "../statistics-states";

export function DetailsError({ onRetry, title }: { onRetry: () => void; title: string }) {
  const t = useTranslations("statistics.details.bucket");

  return (
    <StatisticsSectionState
      action={
        <button
          className="cursor-pointer text-xs font-medium text-primary underline"
          onClick={onRetry}
          type="button"
        >
          {t("retry")}
        </button>
      }
      kind="error"
      title={title}
    />
  );
}

export function DetailsLoading({ label }: { label: string }) {
  return (
    <output aria-busy="true" aria-label={label} className="flex flex-col gap-2">
      <Skeleton className="h-4 w-32 rounded-md" />
      <Skeleton className="h-12 w-full rounded-md" />
      <Skeleton className="h-12 w-full rounded-md" />
    </output>
  );
}

export function LoadMore({
  hasMore,
  isLoading,
  onLoadMore,
}: {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
}): ReactNode {
  const t = useTranslations("statistics.details.bucket");

  if (!hasMore) return null;

  return (
    <Button
      className="self-start"
      disabled={isLoading}
      onClick={onLoadMore}
      size="sm"
      variant="secondary"
    >
      {t("loadMore")}
    </Button>
  );
}
