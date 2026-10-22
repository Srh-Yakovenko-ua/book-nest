import type { ReactNode } from "react";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export type ComparisonNoticeTone = "negative" | "positive" | "same" | "unavailable";

const COMPARISON_NOTICE = {
  description: "text-xs text-muted-foreground",
  frame: "px-3 py-2.5",
  title: "font-sans text-sm font-semibold text-ink",
  tone: {
    negative: { box: "border-warning/25 bg-warning-soft text-warning", icon: "trend-down" },
    positive: { box: "border-success/25 bg-success-soft text-success", icon: "trend-up" },
    same: { box: "border-border bg-muted text-muted-foreground", icon: "minus" },
    unavailable: { box: "border-accent-border bg-accent/30 text-primary", icon: "info" },
  },
} as const satisfies {
  description: string;
  frame: string;
  title: string;
  tone: Record<ComparisonNoticeTone, { box: string; icon: UiIconName }>;
};

export function ReadingComparisonNotice({
  description,
  title,
  tone,
}: {
  description: ReactNode;
  title: ReactNode;
  tone: ComparisonNoticeTone;
}) {
  const toneStyle = COMPARISON_NOTICE.tone[tone];

  return (
    <Alert className={cn(COMPARISON_NOTICE.frame, toneStyle.box)} role="status">
      <UiIcon name={toneStyle.icon} size={16} />
      <AlertTitle className={COMPARISON_NOTICE.title}>{title}</AlertTitle>
      <AlertDescription className={COMPARISON_NOTICE.description}>{description}</AlertDescription>
    </Alert>
  );
}
