"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { CONNECTION_EDGE_STYLES } from "./graph-connection-edge";

const NETWORK_LEGEND = {
  lines: {
    aggregate: { dash: "6 6", opacity: 1, width: 3 },
    dimmed: CONNECTION_EDGE_STYLES.dimmed,
    pair: { dash: undefined, opacity: 1, width: 2 },
  },
  sampleCount: 3,
  swatch: "flex h-4 shrink-0 items-center justify-center rounded border border-border text-xs",
  swatches: {
    count: "min-w-5 rounded-full bg-card px-1 font-semibold",
    group: "w-6 bg-muted",
  },
} as const;

type NetworkLegendLine = keyof typeof NETWORK_LEGEND.lines;

type NetworkLegendSwatch = keyof typeof NETWORK_LEGEND.swatches;

export function GraphNetworkLegend() {
  const t = useTranslations("relationships.workspace.network.legend");

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border bg-card/80 px-3 py-2">
      <p className="shrink-0 text-xs font-semibold text-muted-foreground">{t("title")}</p>
      <ul aria-label={t("title")} className="flex min-w-0 flex-wrap gap-x-4 gap-y-1.5">
        <LegendSwatchItem kind="group" label={t("group")} />
        <LegendLineItem kind="aggregate" label={t("aggregate")} />
        <LegendLineItem kind="pair" label={t("pair")} />
        <LegendSwatchItem kind="count" label={t("count")} />
        <LegendLineItem kind="dimmed" label={t("dimmed")} />
      </ul>
    </div>
  );
}

function LegendLineItem({ kind, label }: { kind: NetworkLegendLine; label: string }) {
  const line = NETWORK_LEGEND.lines[kind];

  return (
    <li className="flex items-center gap-1.5 text-xs text-foreground">
      <svg aria-hidden className="h-2 w-7 shrink-0 overflow-visible" viewBox="0 0 28 8">
        <line
          className="stroke-muted-foreground"
          opacity={line.opacity}
          strokeDasharray={line.dash}
          strokeLinecap="round"
          strokeWidth={line.width}
          x1={1}
          x2={27}
          y1={4}
          y2={4}
        />
      </svg>
      <span>{label}</span>
    </li>
  );
}

function LegendSwatchItem({ kind, label }: { kind: NetworkLegendSwatch; label: string }) {
  return (
    <li className="flex items-center gap-1.5 text-xs text-foreground">
      <span aria-hidden className={cn(NETWORK_LEGEND.swatch, NETWORK_LEGEND.swatches[kind])}>
        {kind === "count" ? NETWORK_LEGEND.sampleCount : null}
      </span>
      <span>{label}</span>
    </li>
  );
}
