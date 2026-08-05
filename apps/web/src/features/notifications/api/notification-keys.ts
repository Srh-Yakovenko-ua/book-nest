const NOTIFICATIONS_ROOT = "/api/notifications";

export const notificationKeys = {
  list: [NOTIFICATIONS_ROOT, "list"] as const,
  root: [NOTIFICATIONS_ROOT] as const,
  unreadCount: [NOTIFICATIONS_ROOT, "unread-count"] as const,
};
