"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type ListSidebarCardProps = {
  children: ReactNode;
  icon: UiIconName;
  title: string;
};

const SIDEBAR_CARD = {
  heading: "flex items-center gap-2 font-heading text-sm font-semibold text-ink",
  icon: "shrink-0 text-primary/70",
  shell: "flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-soft",
  trigger:
    "group flex w-full cursor-pointer items-center justify-between gap-2 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
  triggerChevron:
    "shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180",
} as const;

export function ListSidebar({ children }: { children: ReactNode }) {
  const t = useTranslations("lists.details.sidebar");

  return (
    <aside aria-label={t("label")} className="hidden flex-col gap-6 lg:flex xl:sticky xl:top-6">
      {children}
    </aside>
  );
}

export function ListSidebarCard({ children, icon, title }: ListSidebarCardProps) {
  return (
    <section className={SIDEBAR_CARD.shell}>
      <h2 className={SIDEBAR_CARD.heading}>
        <UiIcon aria-hidden className={SIDEBAR_CARD.icon} name={icon} size={20} />
        {title}
      </h2>
      {children}
    </section>
  );
}

export function ListSidebarCollapsible({ children, icon, title }: ListSidebarCardProps) {
  return (
    <Collapsible asChild>
      <section className={SIDEBAR_CARD.shell}>
        <h2 className={SIDEBAR_CARD.heading}>
          <CollapsibleTrigger className={SIDEBAR_CARD.trigger}>
            <span className="flex min-w-0 items-center gap-2">
              <UiIcon aria-hidden className={SIDEBAR_CARD.icon} name={icon} size={20} />
              {title}
            </span>
            <UiIcon
              aria-hidden
              className={SIDEBAR_CARD.triggerChevron}
              name="chevron-down"
              size={16}
            />
          </CollapsibleTrigger>
        </h2>
        <CollapsibleContent>{children}</CollapsibleContent>
      </section>
    </Collapsible>
  );
}
