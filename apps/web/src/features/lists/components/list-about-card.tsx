"use client";

import type { ListOverviewView, Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";

import { ListSidebarCard, ListSidebarCollapsible } from "./list-sidebar";

type ListAboutCardProps = {
  overview: Nullable<ListOverviewView>;
};

export function ListAboutCard({ overview }: ListAboutCardProps) {
  const t = useTranslations("lists.details.sidebar.about");

  if (!hasAboutData(overview)) return null;

  return (
    <ListSidebarCard icon="info" title={t("title")}>
      <AboutFacts overview={overview} />
    </ListSidebarCard>
  );
}

export function ListAboutCollapsible({ overview }: ListAboutCardProps) {
  const t = useTranslations("lists.details.sidebar.about");

  if (!hasAboutData(overview)) return null;

  return (
    <ListSidebarCollapsible icon="info" title={t("title")}>
      <AboutFacts overview={overview} />
    </ListSidebarCollapsible>
  );
}

function AboutFact({ children, icon }: { children: ReactNode; icon: UiIconName }) {
  return (
    <li className="flex items-start gap-2">
      <UiIcon aria-hidden className="mt-0.5 shrink-0 text-icon" name={icon} size={15} />
      <span className="min-w-0 tabular-nums">{children}</span>
    </li>
  );
}

function AboutFacts({ overview }: { overview: ListOverviewView }) {
  const t = useTranslations("lists.details.sidebar.about");

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2 text-sm text-ink">
        <AboutFact icon="tag">{t("genres", { count: overview.genresCount })}</AboutFact>
        <AboutFact icon="layers">
          {t("seriesAndSolo", { series: overview.seriesCount, solo: overview.soloCount })}
        </AboutFact>
        <AboutFact icon="pages">
          {t("pages", { count: overview.totalPages })}
          {overview.pagesKnownCount < overview.totalBooks ? (
            <span className="block text-xs text-muted-foreground">
              {t("pagesPartial", {
                known: overview.pagesKnownCount,
                total: overview.totalBooks,
              })}
            </span>
          ) : null}
        </AboutFact>
      </ul>

      {overview.topGenres.length === 0 ? null : (
        <div className="flex flex-wrap gap-1.5">
          {overview.topGenres.map((genre) => (
            <Badge key={genre.key} variant="secondary">
              {genre.name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function hasAboutData(overview: Nullable<ListOverviewView>): overview is ListOverviewView {
  return overview !== null && overview.totalBooks > 0;
}
