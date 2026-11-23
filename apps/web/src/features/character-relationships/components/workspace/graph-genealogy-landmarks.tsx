"use client";

import { Panel, useStore } from "@xyflow/react";
import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { GraphGenealogyBranch } from "./graph-genealogy-branches";

import { toGenealogyZoomLevel } from "../../model/workspace/graph-genealogy-camera";
import { toGraphGenealogyHouseTone } from "./graph-genealogy-tones";
import { useGraphTreeScene } from "./graph-tree-scene-context";

const GENEALOGY_LANDMARKS = {
  chip: "flex max-w-full items-center gap-2 rounded-2xl border border-border bg-card/95 py-1 pr-1 pl-3 shadow-soft backdrop-blur-sm",
  jump: "flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card/95 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-foreground shadow-soft outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
} as const;

export function GraphGenealogyLandmarks() {
  const t = useTranslations("relationships.workspace.genealogy.landmarks");
  const { cover, genealogy } = useGraphTreeScene();
  const isOverview = useStore((state) => toGenealogyZoomLevel(state.transform[2]) === "overview");
  if (genealogy === null) return null;
  const { activeBranch, landmarks, onBranch, onClearBranch } = genealogy;
  const centered = { left: `calc(${cover.left}px + (100% - ${cover.left + cover.right}px) / 2)` };

  if (activeBranch !== null) {
    return (
      <Panel className="w-max max-w-64 sm:max-w-xl" position="top-center" style={centered}>
        <div className={GENEALOGY_LANDMARKS.chip} role="status">
          <BranchDot branch={activeBranch} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-foreground">
              {t("active", { name: activeBranch.label })}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {t(activeBranch.kind === "house" ? "activeHouseHint" : "activeFamilyHint", {
                count: activeBranch.count,
              })}
            </span>
          </span>
          <Button
            aria-label={t("clear", { name: activeBranch.label })}
            className="shrink-0"
            onClick={onClearBranch}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <UiIcon name="x" size={14} />
          </Button>
        </div>
      </Panel>
    );
  }

  if (!isOverview || landmarks.length === 0) return null;

  return (
    <Panel className="w-max max-w-64 sm:max-w-xl" position="top-center" style={centered}>
      <nav aria-label={t("label")}>
        <ul className="flex flex-wrap justify-center gap-1.5">
          {landmarks.map((branch) => (
            <li key={branch.id}>
              <button
                aria-label={t("jump", { name: branch.label })}
                className={GENEALOGY_LANDMARKS.jump}
                onClick={() => onBranch(branch.id)}
                type="button"
              >
                <BranchDot branch={branch} />
                {branch.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </Panel>
  );
}

function BranchDot({ branch }: { branch: GraphGenealogyBranch }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2.5 shrink-0 rounded-full",
        branch.tone === null
          ? "bg-muted-foreground/50"
          : toGraphGenealogyHouseTone(branch.tone).dot,
      )}
    />
  );
}
