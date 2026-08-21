import type { BookOrderDerivedStatus } from "@app/shared";

import type { UiIconName } from "@/components/icons";
import type { StatusEntry, StatusTone } from "@/lib/book-status";

const ORDER_STATUS_BADGE: Record<BookOrderDerivedStatus, { icon: UiIconName; tone: StatusTone }> = {
  active: { icon: "package", tone: "neutral" },
  cancelled: { icon: "x-circle", tone: "neutral" },
  partially_received: { icon: "check-circle", tone: "info" },
  partially_shipped: { icon: "truck", tone: "info" },
  received: { icon: "check-circle", tone: "success" },
  shipped: { icon: "truck", tone: "info" },
};

export function toOrderStatusBadge(
  status: BookOrderDerivedStatus,
  label: (status: BookOrderDerivedStatus) => string,
): StatusEntry {
  const meta = ORDER_STATUS_BADGE[status];
  return { icon: meta.icon, label: label(status), tone: meta.tone, value: status };
}
