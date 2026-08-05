"use client";

import type { NotificationView } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { NOTIFICATION_ICONS } from "../model/notification-presentation";
import { resolveNotificationTarget } from "../model/notification-target";
import { NotificationText } from "./notification-text";

type NotificationRowProps = {
  locale: string;
  notification: NotificationView;
  onMarkRead: (id: string) => void;
};

export function NotificationRow({ locale, notification, onMarkRead }: NotificationRowProps) {
  const t = useTranslations("notifications");
  const isUnread = notification.readAt === null;
  const target = resolveNotificationTarget({
    entityState: notification.entityState,
    payload: notification.payload,
  });
  const textClassName = cn("text-sm text-foreground", isUnread ? "font-medium" : "font-normal");
  const messageId = `notification-message-${notification.id}`;
  const markReadLabelId = `notification-mark-read-${notification.id}`;

  return (
    <li
      className={cn(
        "flex items-start gap-2 border-b border-border/50 px-3 py-3 last:border-b-0",
        isUnread && "bg-primary/5",
      )}
    >
      <span aria-hidden className="mt-2 flex size-2 shrink-0 items-center justify-center">
        {isUnread ? <span className="size-2 rounded-full bg-primary" /> : null}
      </span>
      <UiIcon
        className="mt-1 shrink-0 text-muted-foreground"
        name={NOTIFICATION_ICONS[notification.payload.type]}
        size={14}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {isUnread ? <span className="sr-only">{t("row.unread")}</span> : null}
        {target.kind === "book" ? (
          <Link
            className={cn(textClassName, "hover:text-primary hover:underline")}
            href={target.href}
            id={messageId}
          >
            <NotificationText locale={locale} payload={notification.payload} />
          </Link>
        ) : (
          <p className={textClassName} id={messageId}>
            <NotificationText locale={locale} payload={notification.payload} />
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <time className="text-xs text-muted-foreground" dateTime={notification.createdAt}>
            {formatRelativeTime(notification.createdAt, locale)}
          </time>
          {target.kind === "trashed" ? (
            <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {t("entityState.trashed")}
            </span>
          ) : null}
        </div>
      </div>
      <Button
        aria-disabled={!isUnread}
        aria-labelledby={`${markReadLabelId} ${messageId}`}
        className="size-7 shrink-0 text-muted-foreground hover:text-foreground aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
        onClick={() => {
          if (!isUnread) return;
          onMarkRead(notification.id);
        }}
        size="icon"
        variant="ghost"
      >
        <span className="sr-only" id={markReadLabelId}>
          {t("actions.markRead")}
        </span>
        <UiIcon name="check" size={14} />
      </Button>
    </li>
  );
}
