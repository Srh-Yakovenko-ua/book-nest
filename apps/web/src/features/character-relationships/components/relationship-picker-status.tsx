"use client";

import type { Nullable } from "@app/shared";
import type { MouseEvent } from "react";

import { Loader2, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

import { CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";

const PICKER_STATUS = {
  retryValue: "relationship-picker-retry",
} as const;

export type RelationshipPickerStatusMessage = {
  text: string;
  tone: "error" | "info" | "progress";
};

type PickerPagination = {
  isFetchingNextPage: boolean;
  isLoadMoreError: boolean;
};

export function keepPickerInputFocus(event: MouseEvent<HTMLDivElement>) {
  event.preventDefault();
}

export function RelationshipPickerRetryItem({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("common");

  return (
    <CommandItem
      className="min-h-11 cursor-pointer sm:min-h-0"
      onMouseDown={keepPickerInputFocus}
      onSelect={onRetry}
      value={PICKER_STATUS.retryValue}
    >
      <RotateCcw aria-hidden />
      {t("retry")}
    </CommandItem>
  );
}

export function RelationshipPickerStatus({
  loadMoreErrorText,
  message,
  pagination,
}: {
  loadMoreErrorText: string;
  message: Nullable<RelationshipPickerStatusMessage>;
  pagination: PickerPagination;
}) {
  const t = useTranslations("common");
  const shown =
    message ??
    toPaginationMessage({ loadingMoreText: t("loadingMore"), loadMoreErrorText, pagination });

  return (
    <p
      className={cn(
        "flex items-center justify-center gap-2 text-center text-sm",
        shown !== null && "px-3 py-3",
        shown?.tone === "error" ? "text-error" : "text-muted-foreground",
      )}
      role="status"
    >
      {shown?.tone === "progress" ? (
        <Loader2 aria-hidden className="size-3.5 shrink-0 animate-spin" />
      ) : null}
      {shown?.text}
    </p>
  );
}

function toPaginationMessage({
  loadingMoreText,
  loadMoreErrorText,
  pagination,
}: {
  loadingMoreText: string;
  loadMoreErrorText: string;
  pagination: PickerPagination;
}): Nullable<RelationshipPickerStatusMessage> {
  if (pagination.isFetchingNextPage) return { text: loadingMoreText, tone: "progress" };
  if (pagination.isLoadMoreError) return { text: loadMoreErrorText, tone: "error" };
  return null;
}
