"use client";

import type { Nullable, ValueOf } from "@app/shared";

import { NOTIFICATION_BOUNDS } from "@app/shared";
import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useState } from "react";
import { toast } from "sonner";

import type { ChangelogPopoverState } from "@/features/changelog/components/changelog-popover-content";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChangelog, useMarkChangelogSeen } from "@/features/changelog";

import type {
  NotificationLoadMore,
  NotificationLoadMoreStatus,
  NotificationPanelState,
} from "../model/notification-panel-state";

import { useMarkAllNotificationsRead } from "../api/use-mark-all-notifications-read";
import { useMarkNotificationsRead } from "../api/use-mark-notifications-read";
import { useNotifications } from "../api/use-notifications";
import { useNotificationsUnreadCount } from "../api/use-notifications-unread-count";
import { NOTIFICATION_LIST_MAX_HEIGHT } from "../model/notification-panel-state";

const NOTIFICATION_TABS = {
  changelog: "changelog",
  reminders: "reminders",
} as const satisfies Record<string, string>;

type NotificationTab = ValueOf<typeof NOTIFICATION_TABS>;

const NOTIFICATION_TAB_VALUES: readonly string[] = Object.values(NOTIFICATION_TABS);

const FALLBACK_SKELETON_COUNT = 4;

const ChangelogPopoverContent = dynamic(
  () =>
    import("@/features/changelog/components/changelog-popover-content").then(
      (m) => m.ChangelogPopoverContent,
    ),
  { loading: () => <PanelFallback />, ssr: false },
);

const NotificationPanel = dynamic(
  () => import("./notification-panel").then((m) => m.NotificationPanel),
  { loading: () => <PanelFallback />, ssr: false },
);

export function NotificationBell() {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NotificationTab>(NOTIFICATION_TABS.reminders);

  const unreadCountQuery = useNotificationsUnreadCount();
  const notificationsQuery = useNotifications({ enabled: open });
  const changelogQuery = useChangelog(locale);
  const markAllRead = useMarkAllNotificationsRead();
  const markRead = useMarkNotificationsRead();
  const markChangelogSeen = useMarkChangelogSeen();

  const reminderUnread = unreadCountQuery.data?.unreadCount ?? 0;
  const changelogUnread = changelogQuery.data?.pages[0]?.unreadCount ?? 0;
  const totalUnread = reminderUnread + changelogUnread;
  const unreadLabel = t("bell.ariaLabelUnread", { count: totalUnread });

  function revealChangelog() {
    if (changelogUnread > 0 && !markChangelogSeen.isPending) markChangelogSeen.mutate();
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && tab === NOTIFICATION_TABS.changelog) revealChangelog();
  }

  function handleTabChange(value: string) {
    if (!isNotificationTab(value)) return;
    setTab(value);
    if (value === NOTIFICATION_TABS.changelog) revealChangelog();
  }

  return (
    <>
      <span className="sr-only" role="status">
        {totalUnread > 0 ? unreadLabel : t("bell.ariaLabelAllRead")}
      </span>
      <Popover onOpenChange={handleOpenChange} open={open}>
        <PopoverTrigger asChild>
          <Button
            aria-label={totalUnread > 0 ? unreadLabel : t("bell.ariaLabel")}
            className="relative size-9 rounded-lg text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground"
            size="icon"
            variant="ghost"
          >
            <UiIcon name="bell" size={18} />
            {totalUnread > 0 ? (
              <span
                aria-hidden
                className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground tabular-nums ring-2 ring-background"
              >
                {formatBadgeCount(totalUnread)}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          aria-label={t("bell.ariaLabel")}
          className="w-[22rem] max-w-[calc(100vw-1.5rem)] gap-0 p-0"
          sideOffset={8}
        >
          <Tabs className="gap-0" onValueChange={handleTabChange} value={tab}>
            <div className="border-b border-border/60 p-2">
              <TabsList className="w-full">
                <TabsTrigger value={NOTIFICATION_TABS.reminders}>
                  {t("tabs.reminders")}
                  <TabCount value={reminderUnread} />
                </TabsTrigger>
                <TabsTrigger value={NOTIFICATION_TABS.changelog}>
                  {t("tabs.changelog")}
                  <TabCount value={changelogUnread} />
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent
              className="overflow-y-auto"
              style={{ maxHeight: NOTIFICATION_LIST_MAX_HEIGHT }}
              value={NOTIFICATION_TABS.reminders}
            >
              <NotificationPanel
                isMarkingAllRead={markAllRead.isPending}
                locale={locale}
                onMarkAllRead={() =>
                  markAllRead.mutate(undefined, {
                    onError: () => toast.error(t("errors.markAllRead")),
                  })
                }
                onMarkRead={(id) =>
                  markRead.mutate([id], { onError: () => toast.error(t("errors.markRead")) })
                }
                onRetry={() => void notificationsQuery.refetch()}
                state={toPanelState(notificationsQuery)}
                unreadCount={reminderUnread}
              />
            </TabsContent>
            <TabsContent value={NOTIFICATION_TABS.changelog}>
              <ChangelogPopoverContent
                locale={locale}
                onRetry={() => void changelogQuery.refetch()}
                state={toChangelogState(changelogQuery)}
              />
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>
    </>
  );
}

function formatBadgeCount(value: number): string {
  return value > NOTIFICATION_BOUNDS.unreadBadgeCap
    ? `${NOTIFICATION_BOUNDS.unreadBadgeCap}+`
    : String(value);
}

function isNotificationTab(value: string): value is NotificationTab {
  return NOTIFICATION_TAB_VALUES.includes(value);
}

function PanelFallback() {
  const t = useTranslations("notifications.states");

  return (
    <div className="flex flex-col" role="status">
      <span className="sr-only">{t("loading")}</span>
      {Array.from({ length: FALLBACK_SKELETON_COUNT }, (_, index) => (
        <div className="flex flex-col gap-2 border-b border-border/50 px-3 py-3" key={index}>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

function TabCount({ value }: { value: number }) {
  const t = useTranslations("notifications.tabs");

  if (value === 0) return null;

  return (
    <>
      <span
        aria-hidden
        className="rounded-full bg-primary px-1.5 text-[10px] leading-4 font-semibold text-primary-foreground tabular-nums"
      >
        {formatBadgeCount(value)}
      </span>
      <span className="sr-only">{t("unreadCount", { count: value })}</span>
    </>
  );
}

function toChangelogState(query: ReturnType<typeof useChangelog>): ChangelogPopoverState {
  if (query.data === undefined) return query.isError ? { kind: "error" } : { kind: "loading" };

  const entries = query.data.pages.flatMap((page) => page.entries);
  if (entries.length === 0) return { kind: "empty" };

  return {
    entries,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    kind: "ready",
    onEndReached: () => void query.fetchNextPage(),
  };
}

function toLoadMoreStatus(query: ReturnType<typeof useNotifications>): NotificationLoadMoreStatus {
  if (query.isFetchingNextPage) return "loading";
  if (query.isFetchNextPageError) return "failed";
  return "idle";
}

function toPanelLoadMore(
  query: ReturnType<typeof useNotifications>,
): Nullable<NotificationLoadMore> {
  if (!query.hasNextPage) return null;

  return { onLoadMore: () => void query.fetchNextPage(), status: toLoadMoreStatus(query) };
}

function toPanelState(query: ReturnType<typeof useNotifications>): NotificationPanelState {
  if (query.data === undefined) return query.isError ? { kind: "error" } : { kind: "loading" };

  const items = query.data.pages.flatMap((page) => page.items);
  if (items.length === 0) return { kind: "empty" };

  return { items, kind: "ready", loadMore: toPanelLoadMore(query) };
}
