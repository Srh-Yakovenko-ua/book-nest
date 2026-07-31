import type { NotificationType } from "@app/shared";

import type { UiIconName } from "@/components/icons";

export const NOTIFICATION_ICONS = {
  "delivery.arriving_soon": "truck",
  "delivery.arriving_today": "package",
  "delivery.delayed": "clock",
  "loan.due_soon": "clock",
  "loan.due_today": "calendar",
  "loan.overdue": "alert-circle",
  "system.test": "sparkles",
} as const satisfies Record<NotificationType, UiIconName>;
