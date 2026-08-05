"use client";

import type { ReactNode } from "react";

import { Quote } from "lucide-react";
import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

export function DedicationsSidebar({ onChooseBook }: { onChooseBook: () => void }) {
  const t = useTranslations("dedications.sidebar");

  return (
    <aside
      aria-label={t("label")}
      className="flex flex-col gap-4 xl:sticky xl:top-6 xl:w-[19rem] xl:shrink-0"
    >
      <section className="stat-card-branch flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-secondary/40 p-5">
        <Quote aria-hidden className="text-primary/60" size={20} />
        <p className="font-heading text-sm leading-relaxed text-foreground/90 italic">
          {t("quote.text")}
        </p>
      </section>

      <SidebarBlock title={t("addMore.title")}>
        <p className="text-xs leading-relaxed text-muted-foreground">{t("addMore.text")}</p>
        <Button onClick={onChooseBook}>
          <UiIcon name="book" size={16} />
          {t("addMore.cta")}
        </Button>
      </SidebarBlock>
    </aside>
  );
}

function SidebarBlock({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="sidebar-card-leaf flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-card">
      <h2 className="font-heading text-sm font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}
