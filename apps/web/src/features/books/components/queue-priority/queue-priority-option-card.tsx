"use client";

import type { KeyboardEvent } from "react";

import { Circle, CircleCheck, type LucideIcon } from "lucide-react";

import type { PriorityTone } from "../../model/queue-priority";

import {
  priorityCardVariants,
  priorityIconBadgeVariants,
  priorityMarkerVariants,
} from "./queue-priority-variants";

type QueuePriorityOptionCardProps = {
  active: boolean;
  description: string;
  icon: LucideIcon;
  id: string;
  label: string;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onSelect: () => void;
  tabIndex: number;
  tone: PriorityTone;
};

export function QueuePriorityOptionCard({
  active,
  description,
  icon: Icon,
  id,
  label,
  onKeyDown,
  onSelect,
  tabIndex,
  tone,
}: QueuePriorityOptionCardProps) {
  const Marker = active ? CircleCheck : Circle;

  return (
    <button
      aria-checked={active}
      className={priorityCardVariants({ active, tone })}
      id={id}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      role="radio"
      tabIndex={tabIndex}
      type="button"
    >
      <span className={priorityIconBadgeVariants({ tone })}>
        <Icon aria-hidden size={20} strokeWidth={1.8} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </span>
      <Marker
        aria-hidden
        className={priorityMarkerVariants({ active, tone })}
        size={20}
        strokeWidth={1.8}
      />
    </button>
  );
}
