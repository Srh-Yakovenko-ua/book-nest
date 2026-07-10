"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import type { ListsStats } from "../model/lists-derive";

type ListsSidebarProps = {
  onCreateList: () => void;
  stats: ListsStats;
};

export function ListsSidebar({ onCreateList, stats }: ListsSidebarProps) {
  const t = useTranslations("lists.catalog.sidebar");
  const tCard = useTranslations("lists.catalog.card");

  const mostPopular =
    stats.mostPopular === null
      ? "—"
      : `${stats.mostPopular.name} · ${tCard("books", { count: stats.mostPopular.bookCount })}`;

  return (
    <aside
      aria-label={t("actions.title")}
      className="flex flex-col gap-4 xl:sticky xl:top-6 xl:w-[19rem] xl:shrink-0"
    >
      <SidebarBlock title={t("stats.title")}>
        <dl className="flex flex-col gap-2.5">
          <StatRow label={t("stats.totalLists")} value={stats.totalLists.toLocaleString()} />
          <StatRow label={t("stats.booksInLists")} value={stats.booksInLists.toLocaleString()} />
          <StatRow label={t("stats.mostPopular")} value={mostPopular} />
        </dl>
      </SidebarBlock>

      <SidebarBlock title={t("actions.title")}>
        <div className="flex flex-col gap-2">
          <Button className="justify-start" onClick={onCreateList} variant="secondary">
            <UiIcon name="plus" size={16} />
            {t("actions.create")}
          </Button>
          <Button asChild className="justify-start" variant="ghost">
            <Link href="/my-library">
              <UiIcon name="library" size={16} />
              {t("actions.library")}
            </Link>
          </Button>
        </div>
      </SidebarBlock>

      <SidebarBlock title={t("tip.title")}>
        <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
          <UiIcon className="mt-0.5 shrink-0 text-icon" name="bulb" size={15} />
          <span>{t("tip.text")}</span>
        </p>
      </SidebarBlock>
    </aside>
  );
}

function SidebarBlock({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
      <h2 className="font-heading text-sm font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-semibold text-ink tabular-nums">{value}</dd>
    </div>
  );
}
