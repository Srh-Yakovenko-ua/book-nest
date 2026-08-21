"use client";

import type { InTransitImpact } from "@app/shared";

import { IN_TRANSIT_IMPACT_LIMITS } from "@app/shared";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";

import type { DeliveryImpactItem, DeliveryImpactLabels } from "../model/in-transit-impact";

import { buildDeliveryImpactItems } from "../model/in-transit-impact";

type DeliveryImpactBlockProps = {
  impact: readonly InTransitImpact[];
};

export function DeliveryImpactBlock({ impact }: DeliveryImpactBlockProps) {
  const t = useTranslations("delivery.impact");
  const [expanded, setExpanded] = useState(false);

  const labels: DeliveryImpactLabels = {
    goal_books: {
      detail: (goalsCount) => t("goal_books.detail", { count: goalsCount }),
      label: (count) => t("goal_books.label", { count }),
    },
    queue_available: {
      detail: (count) => t("queue_available.detail", { count }),
      label: (count) => t("queue_available.label", { count }),
    },
    series_completed: {
      detail: (count) => t("series_completed.detail", { count }),
      label: (count) => t("series_completed.label", { count }),
    },
    series_next_step: {
      detail: t("series_next_step.detail"),
      label: (count) => t("series_next_step.label", { count }),
    },
    series_ownership_gaps: {
      detail: (count) => t("series_ownership_gaps.detail", { count }),
      label: (count) => t("series_ownership_gaps.label", { count }),
    },
  };

  const items = buildDeliveryImpactItems({ impact, labels });
  if (items.length === 0) {
    return null;
  }

  const hiddenCount = items.length - IN_TRANSIT_IMPACT_LIMITS.visible;
  const visibleItems = expanded ? items : items.slice(0, IN_TRANSIT_IMPACT_LIMITS.visible);

  return (
    <section className="sidebar-card-leaf flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-card">
      <h2 className="flex items-center gap-1.5 font-heading text-sm font-semibold text-ink">
        <UiIcon aria-hidden className="shrink-0 text-primary" name="sparkles" size={16} />
        {t("title")}
      </h2>
      <div className="flex flex-col gap-2">
        <ul className="-mx-1.5 flex flex-col gap-0.5">
          {visibleItems.map((item) => (
            <DeliveryImpactRow item={item} key={item.id} />
          ))}
        </ul>
        {hiddenCount > 0 && !expanded ? (
          <button
            className="group/viewall -mx-1.5 flex cursor-pointer items-center justify-between gap-2 rounded-md px-1.5 py-1 text-xs font-medium text-primary transition-colors outline-none hover:text-primary-hover focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={() => setExpanded(true)}
            type="button"
          >
            <span className="group-hover/viewall:underline">
              {t("viewAll", { count: hiddenCount })}
            </span>
            <UiIcon
              aria-hidden
              className="shrink-0 transition-transform group-hover/viewall:translate-x-0.5 group-focus-visible/viewall:translate-x-0.5"
              name="chevron-down"
              size={16}
            />
          </button>
        ) : null}
      </div>
    </section>
  );
}

function DeliveryImpactRow({ item }: { item: DeliveryImpactItem }) {
  const content = (
    <>
      <UiIcon
        aria-hidden
        className="mt-px shrink-0 self-start text-primary"
        name={item.icon}
        size={16}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="line-clamp-2 text-xs text-ink">{item.label}</span>
        {item.detail === null ? null : (
          <span className="line-clamp-2 text-xs text-muted-foreground tabular-nums">
            {item.detail}
          </span>
        )}
      </span>
    </>
  );

  if (item.href === null) {
    return <li className="flex items-center gap-2 rounded-md px-1.5 py-1.5">{content}</li>;
  }

  return (
    <li>
      <Link
        className="group/impact flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50"
        href={item.href}
      >
        {content}
        <UiIcon
          aria-hidden
          className="mt-px shrink-0 self-start text-muted-foreground transition-transform group-hover/impact:translate-x-0.5 group-focus-visible/impact:translate-x-0.5"
          name="chevron-right"
          size={16}
        />
      </Link>
    </li>
  );
}
