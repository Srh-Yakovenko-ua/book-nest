"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import type {
  NotificationLoadMore,
  NotificationLoadMoreStatus,
  NotificationPanelState,
} from "../model/notification-panel-state";

import { NotificationRow } from "./notification-row";

type NotificationPanelProps = {
  isMarkingAllRead: boolean;
  locale: string;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onRetry: () => void;
  state: NotificationPanelState;
  unreadCount: number;
};

const SKELETON_COUNT = 4;

const LOAD_MORE_LABEL_KEYS = {
  failed: "actions.loadMore",
  idle: "actions.loadMore",
  loading: "states.loadingMore",
} as const satisfies Record<NotificationLoadMoreStatus, string>;

export function NotificationPanel({
  isMarkingAllRead,
  locale,
  onMarkAllRead,
  onMarkRead,
  onRetry,
  state,
  unreadCount,
}: NotificationPanelProps) {
  const t = useTranslations("notifications");
  const isMarkAllReadBlocked = unreadCount === 0 || isMarkingAllRead;

  return (
    <div className="flex w-full flex-col">
      <NotificationPanelBody
        locale={locale}
        onMarkRead={onMarkRead}
        onRetry={onRetry}
        state={state}
      />
      {state.kind === "ready" ? (
        <div className="border-t border-border/60 p-2">
          <Button
            aria-disabled={isMarkAllReadBlocked}
            className="w-full aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            onClick={() => {
              if (isMarkAllReadBlocked) return;
              onMarkAllRead();
            }}
            size="sm"
            variant="ghost"
          >
            <UiIcon name="check-check" size={14} />
            {t("actions.markAllRead")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function NotificationEmptyBlock() {
  const t = useTranslations("notifications.states");

  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <UiIcon className="text-muted-foreground" name="inbox" size={22} />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{t("empty.title")}</p>
        <p className="text-xs text-muted-foreground">{t("empty.description")}</p>
      </div>
    </div>
  );
}

function NotificationErrorBlock({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("notifications.states");

  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center" role="alert">
      <UiIcon className="text-muted-foreground" name="alert-circle" size={22} />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{t("error.title")}</p>
        <p className="text-xs text-muted-foreground">{t("error.description")}</p>
      </div>
      <Button onClick={onRetry} size="sm" variant="secondary">
        <UiIcon name="refresh" size={14} />
        {t("error.retry")}
      </Button>
    </div>
  );
}

function NotificationLoadMoreBlock({ loadMore }: { loadMore: NotificationLoadMore }) {
  const t = useTranslations("notifications");
  const isLoading = loadMore.status === "loading";

  return (
    <div className="border-t border-border/50 p-2">
      {loadMore.status === "failed" ? (
        <p className="px-2 pb-2 text-center text-xs text-destructive" role="alert">
          {t("states.loadMoreError")}
        </p>
      ) : null}
      <Button
        aria-disabled={isLoading}
        className="w-full aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        onClick={() => {
          if (isLoading) return;
          loadMore.onLoadMore();
        }}
        size="sm"
        variant="ghost"
      >
        {t(LOAD_MORE_LABEL_KEYS[loadMore.status])}
      </Button>
    </div>
  );
}

function NotificationPanelBody({
  locale,
  onMarkRead,
  onRetry,
  state,
}: Pick<NotificationPanelProps, "locale" | "onMarkRead" | "onRetry" | "state">) {
  const t = useTranslations("notifications");

  if (state.kind === "loading") return <NotificationSkeletonList />;
  if (state.kind === "error") return <NotificationErrorBlock onRetry={onRetry} />;
  if (state.kind === "empty") return <NotificationEmptyBlock />;

  return (
    <>
      <ul
        aria-label={t("list.ariaLabel")}
        className="flex flex-col motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in"
      >
        {state.items.map((notification) => (
          <NotificationRow
            key={notification.id}
            locale={locale}
            notification={notification}
            onMarkRead={onMarkRead}
          />
        ))}
      </ul>
      {state.loadMore === null ? null : <NotificationLoadMoreBlock loadMore={state.loadMore} />}
    </>
  );
}

function NotificationSkeletonList() {
  const t = useTranslations("notifications.states");

  return (
    <div className="flex flex-col" role="status">
      <span className="sr-only">{t("loading")}</span>
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <div className="flex flex-col gap-2 border-b border-border/50 px-3 py-3" key={index}>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}
