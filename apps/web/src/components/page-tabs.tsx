"use client";

import type { ReactNode } from "react";

import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

export type PageTabsItem = {
  badge?: ReactNode;
  label: string;
  value: string;
};

export const pageTabsDividerClass = "border-b border-border";

export const pageTabsListClass =
  "no-scrollbar -mb-px flex w-full justify-start gap-1 overflow-x-auto";

export const pageTabsTriggerClass = cn(
  "relative inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-4 py-2.5",
  "text-base font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none",
  "hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "data-[state=active]:font-semibold data-[state=active]:text-brand",
  "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand",
  "after:opacity-0 after:transition-opacity data-[state=active]:after:opacity-100",
  "[&_svg]:size-4 [&_svg]:shrink-0",
);

export function PageTabs({
  ariaLabel,
  children,
  className,
  items,
  onValueChange,
  panelId,
  value,
}: {
  ariaLabel?: string;
  children?: ReactNode;
  className?: string;
  items: readonly PageTabsItem[];
  onValueChange: (value: string) => void;
  panelId?: string;
  value: string;
}) {
  return (
    <TabsPrimitive.Root
      className={cn("flex flex-col gap-6", className)}
      data-slot="page-tabs"
      onValueChange={onValueChange}
      value={value}
    >
      <div className={pageTabsDividerClass}>
        <TabsPrimitive.List aria-label={ariaLabel} className={pageTabsListClass}>
          {items.map((item) => (
            <TabsPrimitive.Trigger
              className={pageTabsTriggerClass}
              key={item.value}
              value={item.value}
              {...(panelId === undefined
                ? {}
                : { "aria-controls": panelId, id: pageTabsTriggerId(panelId, item.value) })}
            >
              {item.label}
              {item.badge}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>
      </div>
      {children}
    </TabsPrimitive.Root>
  );
}

export function PageTabsPanel({
  children,
  className,
  value,
}: {
  children: ReactNode;
  className?: string;
  value: string;
}) {
  return (
    <TabsPrimitive.Content
      className={cn("flex-1 outline-none", className)}
      data-slot="page-tabs-panel"
      value={value}
    >
      {children}
    </TabsPrimitive.Content>
  );
}

export function pageTabsTriggerId(panelId: string, value: string): string {
  return `${panelId}-tab-${value}`;
}
