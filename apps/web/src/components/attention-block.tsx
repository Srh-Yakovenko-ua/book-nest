"use client";

import type { Nullable } from "@app/shared";

import { UiIcon, type UiIconName } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type AttentionItem<TId extends string> = {
  caption?: string;
  detail?: string;
  icon: UiIconName;
  id: TId;
  label: string;
  toneClass: string;
};

type AttentionBlockProps<TId extends string> = {
  activeId: Nullable<TId>;
  allClearLabel: string;
  isLoading: boolean;
  items: AttentionItem<TId>[];
  onSelect: (id: TId) => void;
  title: string;
  viewAll?: {
    active: boolean;
    label: string;
    onSelect: () => void;
  };
};

export function AttentionBlock<TId extends string>({
  activeId,
  allClearLabel,
  isLoading,
  items,
  onSelect,
  title,
  viewAll,
}: AttentionBlockProps<TId>) {
  return (
    <section className="sidebar-card-leaf flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-card">
      <h2 className="flex items-center gap-1.5 font-heading text-sm font-semibold text-ink">
        <UiIcon aria-hidden className="shrink-0 text-warning" name="alert-triangle" size={16} />
        {title}
      </h2>
      {isLoading ? (
        <AttentionSkeleton />
      ) : items.length === 0 ? (
        <div className="flex items-center gap-2">
          <UiIcon aria-hidden className="shrink-0 text-success" name="check-circle" size={16} />
          <span className="text-xs text-muted-foreground">{allClearLabel}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <ul className="-mx-1.5 flex flex-col gap-0.5">
            {items.map((item) => (
              <AttentionRow
                active={activeId === item.id}
                item={item}
                key={item.id}
                onSelect={onSelect}
              />
            ))}
          </ul>
          {viewAll === undefined ? null : (
            <button
              aria-pressed={viewAll.active}
              className={cn(
                "group/viewall -mx-1.5 flex cursor-pointer items-center justify-between gap-2 rounded-md px-1.5 py-1 text-xs font-medium text-primary transition-colors outline-none hover:text-primary-hover focus-visible:ring-3 focus-visible:ring-ring/50",
                viewAll.active && "text-primary-hover",
              )}
              onClick={viewAll.onSelect}
              type="button"
            >
              <span className="group-hover/viewall:underline">{viewAll.label}</span>
              <UiIcon
                aria-hidden
                className="shrink-0 transition-transform group-hover/viewall:translate-x-0.5 group-focus-visible/viewall:translate-x-0.5"
                name="arrow-right"
                size={16}
              />
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function AttentionRow<TId extends string>({
  active,
  item,
  onSelect,
}: {
  active: boolean;
  item: AttentionItem<TId>;
  onSelect: (id: TId) => void;
}) {
  return (
    <li>
      <button
        aria-pressed={active}
        className={cn(
          "group/attention flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50",
          active && "bg-secondary",
        )}
        onClick={() => onSelect(item.id)}
        type="button"
      >
        <UiIcon
          aria-hidden
          className={cn("mt-px shrink-0 self-start", item.toneClass)}
          name={item.icon}
          size={16}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-xs text-ink">{item.label}</span>
          {item.detail === undefined ? null : (
            <span className="truncate text-xs text-muted-foreground tabular-nums">
              {item.detail}
            </span>
          )}
          {item.caption === undefined ? null : (
            <span className="text-[0.6875rem] leading-snug text-muted-foreground">
              {item.caption}
            </span>
          )}
        </span>
        <UiIcon
          aria-hidden
          className="mt-px shrink-0 self-start text-muted-foreground transition-transform group-hover/attention:translate-x-0.5 group-focus-visible/attention:translate-x-0.5"
          name="chevron-right"
          size={16}
        />
      </button>
    </li>
  );
}

function AttentionSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 2 }, (_, index) => (
        <div className="flex flex-col gap-1 px-2" key={index}>
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
