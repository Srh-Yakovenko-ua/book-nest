import type { UiIconName } from "@/components/icons";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";

export type DeliverySummaryCard = {
  icon: UiIconName;
  label: string;
  value: string;
};

type DeliverySummaryCardsProps = {
  cards: DeliverySummaryCard[];
  isLoading: boolean;
};

const SKELETON_COUNT = 5;

export function DeliverySummaryCards({ cards, isLoading }: DeliverySummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
      {isLoading
        ? Array.from({ length: SKELETON_COUNT }, (_, index) => <SummaryCardSkeleton key={index} />)
        : cards.map((card) => (
            <StatCard
              icon={card.icon}
              key={card.label}
              label={card.label}
              size="compact"
              value={card.value}
            />
          ))}
    </div>
  );
}

function SummaryCardSkeleton() {
  return (
    <Card className="flex flex-row items-center gap-2.5 border border-border bg-card px-3 py-3 shadow-card sm:gap-3 sm:px-4 sm:py-3.5">
      <Skeleton className="size-10 shrink-0 rounded-full sm:size-11" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-6 w-12" />
      </div>
    </Card>
  );
}
