import type { NotificationView, Nullable } from "@app/shared";

export type NotificationLoadMore = {
  onLoadMore: () => void;
  status: NotificationLoadMoreStatus;
};

export type NotificationLoadMoreStatus = "failed" | "idle" | "loading";

export type NotificationPanelState =
  | {
      items: NotificationView[];
      kind: "ready";
      loadMore: Nullable<NotificationLoadMore>;
    }
  | { kind: "empty" }
  | { kind: "error" }
  | { kind: "loading" };

export const NOTIFICATION_LIST_MAX_HEIGHT = "min(60vh, 26rem)";
