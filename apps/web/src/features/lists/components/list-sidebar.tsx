"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";

type ListSidebarCardProps = {
  children: ReactNode;
  icon: UiIconName;
  title: string;
};

const SIDEBAR_CARD = {
  heading: "flex items-center gap-2 font-heading text-sm font-semibold text-ink",
  icon: "shrink-0 text-primary/70",
  shell:
    "sidebar-card-leaf flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-5 shadow-soft",
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
