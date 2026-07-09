"use client";

import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

import type { ChangelogPopoverState } from "./changelog-popover-content";

import { useChangelog } from "../api/use-changelog";
import { useMarkChangelogSeen } from "../api/use-mark-changelog-seen";

const UNREAD_DISPLAY_CAP = 9;
const FALLBACK_SKELETON_COUNT = 4;

const ChangelogPopoverContent = dynamic(
  () => import("./changelog-popover-content").then((m) => m.ChangelogPopoverContent),
  {
    loading: () => <ChangelogPopoverFallback />,
    ssr: false,
  },
);

export function ChangelogBell() {
  const t = useTranslations("changelog");
  const locale = useLocale();
  const query = useChangelog(locale);
  const markSeen = useMarkChangelogSeen();
  const [open, setOpen] = useState(false);

  const data = query.data;
  const unreadCount = data?.pages[0]?.unreadCount ?? 0;
  const entries = data?.pages.flatMap((page) => page.entries) ?? [];

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && unreadCount > 0 && !markSeen.isPending) {
      markSeen.mutate();
    }
  }

  const state: ChangelogPopoverState = query.isError
    ? { kind: "error" }
    : data === undefined
      ? { kind: "loading" }
      : entries.length === 0
        ? { kind: "empty" }
        : {
            entries,
            hasNextPage: query.hasNextPage,
            isFetchingNextPage: query.isFetchingNextPage,
            kind: "ready",
            onEndReached: () => void query.fetchNextPage(),
          };

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-label={
            unreadCount > 0
              ? t("bell.ariaLabelUnread", { count: unreadCount })
              : t("bell.ariaLabel")
          }
          className="relative size-9 rounded-lg text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground"
          size="icon"
          variant="ghost"
        >
          <UiIcon name="bell" size={18} />
          {unreadCount > 0 ? (
            <span
              aria-hidden
              className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground tabular-nums"
            >
              {unreadCount > UNREAD_DISPLAY_CAP ? `${UNREAD_DISPLAY_CAP}+` : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[22rem] max-w-[calc(100vw-1.5rem)] gap-0 p-0"
        sideOffset={8}
      >
        <ChangelogPopoverContent
          locale={locale}
          onRetry={() => void query.refetch()}
          state={state}
        />
      </PopoverContent>
    </Popover>
  );
}

function ChangelogPopoverFallback() {
  const t = useTranslations("changelog");

  return (
    <div className="flex w-full flex-col">
      <header className="flex items-center gap-2 border-b border-border/60 px-3.5 py-3">
        <UiIcon className="text-primary" name="sparkles" size={16} />
        <h2 className="font-heading text-sm font-medium text-foreground">{t("title")}</h2>
      </header>
      <div aria-busy className="flex flex-col">
        {Array.from({ length: FALLBACK_SKELETON_COUNT }, (_, index) => (
          <div className="flex flex-col gap-2 border-b border-border/50 px-3.5 py-3" key={index}>
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-3 w-14" />
            </div>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
