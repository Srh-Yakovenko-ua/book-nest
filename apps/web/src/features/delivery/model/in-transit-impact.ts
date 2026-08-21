import type { InTransitImpact, InTransitImpactKind, Nullable } from "@app/shared";

import type { UiIconName } from "@/components/icons";

export type DeliveryImpactItem = {
  detail: Nullable<string>;
  href: Nullable<string>;
  icon: UiIconName;
  id: InTransitImpactKind;
  label: string;
};

export type DeliveryImpactLabels = {
  goal_books: {
    detail: (goalsCount: number) => string;
    label: (count: number) => string;
  };
  queue_available: {
    detail: (count: number) => string;
    label: (count: number) => string;
  };
  series_completed: {
    detail: (count: number) => string;
    label: (count: number) => string;
  };
  series_next_step: {
    detail: string;
    label: (count: number) => string;
  };
  series_ownership_gaps: {
    detail: (count: number) => string;
    label: (count: number) => string;
  };
};

type ImpactPresentation = {
  href: Nullable<string>;
  icon: UiIconName;
};

const DELIVERY_IMPACT_ROW = {
  goal_books: { href: null, icon: "target" },
  queue_available: { href: "/reading-queue", icon: "bookmark" },
  series_completed: { href: null, icon: "library-big" },
  series_next_step: { href: null, icon: "book" },
  series_ownership_gaps: { href: null, icon: "layers" },
} as const satisfies Record<InTransitImpactKind, ImpactPresentation>;

export function buildDeliveryImpactItems({
  impact,
  labels,
}: {
  impact: readonly InTransitImpact[];
  labels: DeliveryImpactLabels;
}): DeliveryImpactItem[] {
  return impact.map((entry) => {
    const { href, icon } = DELIVERY_IMPACT_ROW[entry.kind];
    return { ...toImpactText({ entry, labels }), href, icon, id: entry.kind };
  });
}

function assertNever(value: never): never {
  throw new Error(`Unhandled impact kind: ${JSON.stringify(value)}`);
}

function toImpactText({
  entry,
  labels,
}: {
  entry: InTransitImpact;
  labels: DeliveryImpactLabels;
}): { detail: Nullable<string>; label: string } {
  switch (entry.kind) {
    case "goal_books":
      return {
        detail: labels.goal_books.detail(entry.goalsCount),
        label: labels.goal_books.label(entry.booksCount),
      };
    case "queue_available":
      return {
        detail:
          entry.highPriorityCount === 0
            ? null
            : labels.queue_available.detail(entry.highPriorityCount),
        label: labels.queue_available.label(entry.booksCount),
      };
    case "series_completed":
      return {
        detail: labels.series_completed.detail(entry.booksCount),
        label: labels.series_completed.label(entry.seriesCount),
      };
    case "series_next_step":
      return {
        detail: labels.series_next_step.detail,
        label: labels.series_next_step.label(entry.seriesCount),
      };
    case "series_ownership_gaps":
      return {
        detail: labels.series_ownership_gaps.detail(entry.booksCount),
        label: labels.series_ownership_gaps.label(entry.seriesCount),
      };
    default:
      return assertNever(entry);
  }
}
