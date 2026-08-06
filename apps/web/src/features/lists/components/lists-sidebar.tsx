"use client";

import type { Nullable } from "@app/shared";

import { LIST_STALE_MONTHS } from "@app/shared";
import { useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { AttentionBlock } from "@/components/attention-block";
import { UiIcon } from "@/components/icons";

import type { ListAttentionReason } from "../model/lists-query";

import { LIST_ATTENTION_REASONS } from "../model/lists-query";

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
      <section className="stat-card-branch flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-secondary/40 p-5">
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-ink">
          <UiIcon aria-hidden className="shrink-0 text-primary/60" name="bulb" size={20} />
          {t("tip.title")}
        </h2>
        <p className="font-heading text-sm leading-relaxed text-foreground/90 italic">
          {t("tip.text")}
        </p>
      </section>

      <AttentionBlock
        activeId={activeAttention}
        allClearLabel={tAttention("allClear")}
        isLoading={isLoading}
        items={items}
        onSelect={onAttentionSelect}
        title={tAttention("title")}
      />
    </aside>
  );
}
