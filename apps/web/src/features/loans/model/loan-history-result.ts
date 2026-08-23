import type { LoanHistoryResult } from "@app/shared";

import type { UiIconName } from "@/components/icons";

export const LOAN_HISTORY_RESULT_LOOK = {
  late: { icon: "clock", surfaceClass: "bg-warning-soft", toneClass: "text-warning" },
  no_due_date: {
    icon: "circle-slash",
    surfaceClass: "bg-secondary",
    toneClass: "text-muted-foreground",
  },
  on_time: { icon: "check-circle", surfaceClass: "bg-success-soft", toneClass: "text-success" },
} as const satisfies Record<
  LoanHistoryResult,
  { icon: UiIconName; surfaceClass: string; toneClass: string }
>;
