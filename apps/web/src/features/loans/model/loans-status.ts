import type { LoanUiStatus } from "@app/shared";

import type { UiIconName } from "@/components/icons";
import type { StatusTone } from "@/lib/book-status";

export const LOAN_STATUS_META = {
  no_return_date: { icon: "circle-slash", tone: "neutral" },
  on_time: { icon: "check-circle", tone: "success" },
  overdue: { icon: "alert-triangle", tone: "danger" },
  return_soon: { icon: "bell", tone: "warning" },
} as const satisfies Record<LoanUiStatus, { icon: UiIconName; tone: StatusTone }>;
