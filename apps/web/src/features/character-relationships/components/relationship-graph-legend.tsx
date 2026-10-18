"use client";

import type { CharacterGraphClusterView } from "@app/shared";

import { useTranslations } from "next-intl";

import { assertNever } from "@/lib/assert-never";
import { cn } from "@/lib/utils";

import { toRelationshipGraphClusterTones } from "./relationship-graph-tones";

export function RelationshipGraphLegend({ clusters }: { clusters: CharacterGraphClusterView[] }) {
  const t = useTranslations("relationships.graph");
  const tImportance = useTranslations("characters.importance");
  if (clusters.length === 0) return null;

  const tones = toRelationshipGraphClusterTones(clusters);

  function clusterLabel(cluster: CharacterGraphClusterView): string {
    switch (cluster.kind) {
      case "group":
        return cluster.name ?? t(`groupTypes.${cluster.groupType}`);
      case "importance":
        return tImportance(cluster.importance);
      default:
        return assertNever(cluster);
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted-foreground">{t("legend.title")}</h3>
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {clusters.map((cluster) => (
          <li className="flex items-center gap-2 text-sm text-foreground" key={cluster.id}>
            <span
              aria-hidden
              className={cn("size-3 shrink-0 rounded-full", tones.get(cluster.id)?.swatch)}
            />
            <span className="max-w-48 truncate">{clusterLabel(cluster)}</span>
            <span className="text-xs text-muted-foreground">{cluster.size}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
