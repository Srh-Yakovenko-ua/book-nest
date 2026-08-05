"use client";

import type { Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { AttentionBlock } from "@/components/attention-block";
import { UiIcon } from "@/components/icons";

import type { ListAttentionReason } from "../model/lists-derive";

import { LIST_ATTENTION_REASONS, LIST_STALE_MONTHS } from "../model/lists-derive";

type ListsSidebarProps = {
  activeAttention: Nullable<ListAttentionReason>;
  attentionCounts: Record<ListAttentionReason, number>;
  isLoading: boolean;
  onAttentionSelect: (reason: ListAttentionReason) => void;
};

const ATTENTION_ROW_META: Record<ListAttentionReason, { icon: UiIconName; toneClass: string }> = {
  empty: { icon: "book-x", toneClass: "text-destructive" },
  no_description: { icon: "file-warning", toneClass: "text-muted-foreground" },
  stale: { icon: "clock", toneClass: "text-warning" },
};

export function ListsSidebar({
  activeAttention,
  attentionCounts,
  isLoading,
  onAttentionSelect,
}: ListsSidebarProps) {
  const t = useTranslations("lists.catalog.sidebar");
  const tAttention = useTranslations("lists.catalog.attention");

  const items = LIST_ATTENTION_REASONS.filter((reason) => attentionCounts[reason] > 0).map(
    (reason) => ({
      ...ATTENTION_ROW_META[reason],
      caption: tAttention(`${reason}.caption`),
      detail: tAttention(`${reason}.detail`, {
        count: attentionCounts[reason],
        months: LIST_STALE_MONTHS,
      }),
      id: reason,
      label: tAttention(`${reason}.title`),
    }),
  );

  return (
    <aside
      aria-label={tAttention("title")}
      className="flex flex-col gap-4 xl:sticky xl:top-6 xl:w-[19rem] xl:shrink-0"
    >
      <AttentionBlock
        activeId={activeAttention}
        allClearLabel={tAttention("allClear")}
        isLoading={isLoading}
        items={items}
        onSelect={onAttentionSelect}
        title={tAttention("title")}
      />

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
