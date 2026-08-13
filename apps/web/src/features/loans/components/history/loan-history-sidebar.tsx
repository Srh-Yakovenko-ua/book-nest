"use client";

import type { LoanHistoryOverviewView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import {
  MobilePageOverviewPanel,
  MobilePageOverviewTrigger,
  useMobilePageOverviewPanel,
} from "@/components/ui/mobile-page-overview-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type LoanHistorySidebarProps = {
  activePerson: string;
  isLoading: boolean;
  onPersonSelect: (personName: string) => void;
  overview: LoanHistoryOverviewView | undefined;
};

export function LoanHistoryOverviewPanel(props: LoanHistorySidebarProps) {
  const t = useTranslations("loans.history.overviewPanel");
  const panel = useMobilePageOverviewPanel();

  return (
    <>
      <MobilePageOverviewTrigger label={t("trigger")} onClick={() => panel.setOpen(true)} />

      <MobilePageOverviewPanel
        closeLabel={t("close")}
        panel={panel}
        subtitle={t("subtitle")}
        title={t("title")}
      >
        <div className="flex flex-col gap-4">
          <LoanHistorySidebarSections
            {...props}
            onPersonSelect={(personName) => panel.closeThen(() => props.onPersonSelect(personName))}
          />
        </div>
      </MobilePageOverviewPanel>
    </>
  );
}

export function LoanHistorySidebar(props: LoanHistorySidebarProps) {
  const t = useTranslations("loans.history.sidebar");

  return (
    <aside
      aria-label={t("label")}
      className="flex flex-col gap-4 max-sm:hidden xl:sticky xl:top-6 xl:w-[19rem] xl:shrink-0"
    >
      <LoanHistorySidebarSections {...props} />
    </aside>
  );
}

function DurationBlock({
  duration,
  isLoading,
}: {
  duration: LoanHistoryOverviewView["duration"] | undefined;
  isLoading: boolean;
}) {
  const t = useTranslations("loans.history.sidebar.duration");

  const metrics = [
    { days: duration?.averageDays ?? null, key: "average" },
    { days: duration?.longestDays ?? null, key: "longest" },
    { days: duration?.shortestDays ?? null, key: "shortest" },
  ] as const;

  const rows = metrics.flatMap(({ days, key }) => (days === null ? [] : [{ days, key }]));

  return (
    <SidebarBlock title={t("title")}>
      {isLoading ? (
        <RowSkeleton rows={3} />
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("empty")}</p>
      ) : (
        <dl className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <MetricRow key={row.key} label={t(row.key)} value={t("days", { count: row.days })} />
          ))}
        </dl>
      )}
    </SidebarBlock>
  );
}

function LoanHistorySidebarSections({
  activePerson,
  isLoading,
  onPersonSelect,
  overview,
}: LoanHistorySidebarProps) {
  return (
    <>
      <PeopleBlock
        activePerson={activePerson}
        isLoading={isLoading}
        onPersonSelect={onPersonSelect}
        people={overview?.topPeople ?? []}
      />
      <DurationBlock duration={overview?.duration} isLoading={isLoading} />
      <ReliabilityBlock isLoading={isLoading} reliability={overview?.reliability} />
    </>
  );
}

function MetricRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 truncate text-sm text-muted-foreground">{label}</dt>
      <dd className="shrink-0 text-sm font-semibold text-ink tabular-nums">{value}</dd>
    </div>
  );
}

function PeopleBlock({
  activePerson,
  isLoading,
  onPersonSelect,
  people,
}: {
  activePerson: string;
  isLoading: boolean;
  onPersonSelect: (personName: string) => void;
  people: LoanHistoryOverviewView["topPeople"];
}) {
  const t = useTranslations("loans.history.sidebar.people");

  return (
    <SidebarBlock title={t("title")}>
      {isLoading ? <RowSkeleton rows={3} /> : null}

      {!isLoading && people.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("empty")}</p>
      ) : null}

      {!isLoading && people.length > 0 ? (
        <ul className="-mx-1.5 flex flex-col gap-0.5">
          {people.map((person) => (
            <li key={person.personName}>
              <button
                aria-label={t("filter", { name: person.personName })}
                aria-pressed={person.personName === activePerson}
                className={cn(
                  "group/person flex w-full cursor-pointer flex-col gap-0.5 rounded-md px-1.5 py-1.5 text-left transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50",
                  person.personName === activePerson && "bg-secondary",
                )}
                onClick={() => onPersonSelect(person.personName)}
                type="button"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium text-ink transition-colors group-hover/person:text-primary">
                    {person.personName}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {t("count", { count: person.totalCount })}
                  </span>
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {t("breakdown", { borrowed: person.borrowedCount, lent: person.lentCount })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </SidebarBlock>
  );
}

function ReliabilityBlock({
  isLoading,
  reliability,
}: {
  isLoading: boolean;
  reliability: LoanHistoryOverviewView["reliability"] | undefined;
}) {
  const t = useTranslations("loans.history.sidebar.reliability");

  const total =
    reliability === undefined
      ? 0
      : reliability.onTimeCount + reliability.lateCount + reliability.noDueDateCount;

  return (
    <SidebarBlock title={t("title")}>
      {isLoading ? (
        <RowSkeleton rows={2} />
      ) : reliability === undefined || total === 0 ? (
        <p className="text-xs text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          <p className="font-heading text-sm font-semibold text-ink">
            {t("onTimePercent", { percent: reliability.onTimePercent })}
          </p>
          <dl className="flex flex-col gap-1.5">
            <MetricRow label={t("onTime")} value={reliability.onTimeCount} />
            <MetricRow label={t("late")} value={reliability.lateCount} />
            <MetricRow label={t("noDueDate")} value={reliability.noDueDateCount} />
          </dl>
        </>
      )}
    </SidebarBlock>
  );
}

function RowSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, index) => (
        <div className="flex items-center justify-between gap-2" key={index}>
          <Skeleton className="h-3.5 w-2/5" />
          <Skeleton className="h-3.5 w-12" />
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
