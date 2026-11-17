"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import type {
  GraphPresentationEmpty,
  GraphPresentationNotice,
} from "../../model/workspace/graph-workspace-presentation";

type GraphSceneStatusProps = {
  empty: Nullable<GraphPresentationEmpty>;
  notices: readonly GraphPresentationNotice[];
  onResetFilters: () => void;
};

export function GraphSceneStatus({ empty, notices, onResetFilters }: GraphSceneStatusProps) {
  const t = useTranslations("relationships.workspace");

  return (
    <div className="flex flex-col gap-2 text-sm">
      {empty === null ? null : (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-3 py-2">
          <span>
            <span className="font-medium">{t(`states.${empty}.title`)}</span>{" "}
            <span className="text-muted-foreground">{t(`states.${empty}.description`)}</span>
          </span>
          {empty === "filteredEmpty" ? (
            <Button onClick={onResetFilters} size="sm" type="button" variant="outline">
              {t("filters.reset")}
            </Button>
          ) : null}
        </div>
      )}
      {notices.length === 0 ? null : (
        <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
          {notices.map((notice) => (
            <li key={notice}>{t(`notices.${notice}`)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
