"use client";

import type { ReadingHistoryDayView } from "@app/shared";

import { ChevronDown } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

import { ReadingDaySummaryRow } from "../reading/reading-day-summary-row";
import { ReadingHistoryEvent } from "./reading-history-event";

type ReadingHistoryDayProps = {
  day: ReadingHistoryDayView;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function ReadingHistoryDay({ day, onOpenChange, open }: ReadingHistoryDayProps) {
  return (
    <Collapsible asChild onOpenChange={onOpenChange} open={open}>
      <li className="rounded-lg border border-border/60 bg-card">
        <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <ReadingDaySummaryRow
            date={day.date}
            finalPage={day.finalPage}
            pagesRead={day.pagesRead}
            updatesCount={day.updatesCount}
          />
          <ChevronDown
            aria-hidden
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ol className="flex flex-col gap-2.5 border-t border-border/60 px-3 py-3">
            {day.events.map((event) => (
              <ReadingHistoryEvent event={event} key={event.id} />
            ))}
          </ol>
        </CollapsibleContent>
      </li>
    </Collapsible>
  );
}
