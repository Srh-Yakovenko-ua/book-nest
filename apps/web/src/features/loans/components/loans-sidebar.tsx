"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import type { NearestReturn } from "../model/loans-derive";

type LoansSidebarProps = {
  isLoading: boolean;
  nearest: NearestReturn[];
  onAddBook: () => void;
};

export function LoansSidebar({ isLoading, nearest, onAddBook }: LoansSidebarProps) {
  const t = useTranslations("loans.sidebar");

  return (
    <aside
      aria-label={t("tips.title")}
      className="flex flex-col gap-4 xl:sticky xl:top-6 xl:w-[19rem] xl:shrink-0"
    >
      <SidebarBlock title={t("tips.title")}>
        <ul className="flex flex-col gap-2 text-xs leading-relaxed text-muted-foreground">
          <li className="flex gap-2">
            <UiIcon className="mt-0.5 shrink-0 text-icon" name="note" size={14} />
            {t("tips.note")}
          </li>
          <li className="flex gap-2">
            <UiIcon className="mt-0.5 shrink-0 text-icon" name="bell" size={14} />
            {t("tips.reminder")}
          </li>
          <li className="flex gap-2">
            <UiIcon className="mt-0.5 shrink-0 text-icon" name="heart" size={14} />
            {t("tips.care")}
          </li>
        </ul>
        <p className="text-xs text-muted-foreground/80">{t("tips.footer")}</p>
      </SidebarBlock>

      <SidebarBlock title={t("nearest.title")}>
        {isLoading ? (
          <RowSkeleton rows={3} />
        ) : nearest.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("nearest.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {nearest.map((entry) => (
              <li className="flex items-center gap-2.5" key={entry.id}>
                <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                  {entry.date}
                </span>
                <span className="truncate text-sm text-ink">{entry.title}</span>
              </li>
            ))}
          </ul>
        )}
      </SidebarBlock>

      <SidebarBlock title={t("cta.title")}>
        <p className="text-xs leading-relaxed text-muted-foreground">{t("cta.text")}</p>
        <Button className="justify-start" onClick={onAddBook} variant="secondary">
          <UiIcon name="plus" size={16} />
          {t("cta.button")}
        </Button>
      </SidebarBlock>
    </aside>
  );
}

function RowSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, index) => (
        <div className="flex items-center gap-2.5" key={index}>
          <Skeleton className="h-3.5 w-10 shrink-0" />
          <Skeleton className="h-3.5 w-4/5" />
        </div>
      ))}
    </div>
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
