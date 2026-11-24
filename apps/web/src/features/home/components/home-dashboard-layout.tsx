import type { Nullable } from "@app/shared";
import type { ReactElement } from "react";

import type { HomeZoneKey, HomeZonePresence } from "../model/home-layout";

import { homeLayoutRows } from "../model/home-layout";

export type HomeDashboardContent =
  { kind: "onboarding"; onboarding: ReactElement } | { kind: "zones"; zones: HomeDashboardZones };

export type HomeDashboardZones = Record<HomeZoneKey, Nullable<ReactElement>>;

type HomeDashboardLayoutProps = {
  content: HomeDashboardContent;
  welcome: ReactElement;
};

export function HomeDashboardLayout({ content, welcome }: HomeDashboardLayoutProps) {
  return (
    <div className="@container/home flex min-w-0 flex-col gap-3 @6xl/home:gap-4">
      {welcome}
      {content.kind === "onboarding" ? (
        content.onboarding
      ) : (
        <HomeDashboardZonesGrid zones={content.zones} />
      )}
    </div>
  );
}

function HomeDashboardZonesGrid({ zones }: { zones: HomeDashboardZones }) {
  return homeLayoutRows(zonePresence(zones)).map((row) => (
    <div className={row.className} data-home-row={row.key} key={row.key}>
      {row.cells.map((cell) => (
        <div className={cell.className} data-home-zone={cell.zone} key={cell.zone}>
          {zones[cell.zone]}
        </div>
      ))}
    </div>
  ));
}

function zonePresence(zones: HomeDashboardZones): HomeZonePresence {
  return {
    attention: zones.attention !== null,
    criticalBanner: zones.criticalBanner !== null,
    currentlyReading: zones.currentlyReading !== null,
    memory: zones.memory !== null,
    nextRead: zones.nextRead !== null,
    readingGoal: zones.readingGoal !== null,
    readingWeek: zones.readingWeek !== null,
    recentBooks: zones.recentBooks !== null,
  };
}
