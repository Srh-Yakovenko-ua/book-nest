"use client";

import type { CancelledFollowUpView, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon, type UiIconName } from "@/components/icons";
import { LibraryOverviewSection } from "@/features/books/components/library-overview-blocks";

import { buildCancelledOutcomeRows } from "../model/cancelled-follow-up";

type DeliveryCancelledOutcomeBlockProps = {
  outcomes: Nullable<CancelledFollowUpView["outcomes"]>;
};

const OUTCOME_ICON = {
  borrowed: "user",
  inLibrary: "check-circle",
  reordered: "truck",
  unresolved: "help-circle",
  wishlist: "cart",
} as const satisfies Record<string, UiIconName>;

export function DeliveryCancelledOutcomeBlock({ outcomes }: DeliveryCancelledOutcomeBlockProps) {
  const t = useTranslations("delivery.history.cancelledOutcome");

  if (outcomes === null || outcomes === undefined) {
    return null;
  }

  const rows = buildCancelledOutcomeRows({
    counts: outcomes,
    label: (outcome, count) => t(`outcomes.${outcome}`, { count }),
  });

  return (
    <LibraryOverviewSection className="sidebar-card-leaf" title={t("title")}>
      <div className="flex flex-col gap-3">
        <p className="font-heading text-lg leading-tight font-semibold text-ink">
          {t("booksCount", { count: outcomes.totalBooksCount })}
        </p>

        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li className="flex items-start gap-2 text-sm text-foreground" key={row.key}>
              <UiIcon
                aria-hidden
                className="mt-0.5 shrink-0 text-icon"
                name={OUTCOME_ICON[row.key]}
                size={15}
              />
              <span className="min-w-0">{row.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </LibraryOverviewSection>
  );
}
