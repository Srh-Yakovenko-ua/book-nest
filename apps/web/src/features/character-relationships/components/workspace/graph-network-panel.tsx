"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import { assertNever } from "@/lib/assert-never";

import type { GraphNetworkPanelContentProps } from "./graph-network-panel-content";
import type { GraphNetworkPanelTarget } from "./graph-network-panel-target";
import type { WorkspaceWidthClass } from "./use-workspace-width-class";

import { GraphDetailsPanel } from "./graph-details-panel";
import { GraphNetworkPanelContent } from "./graph-network-panel-content";

type GraphNetworkPanelProps = GraphNetworkPanelContentProps & {
  hasSelection: boolean;
  onClose: () => void;
  onRestoreFocus: () => void;
  target: Nullable<GraphNetworkPanelTarget>;
  widthClass: WorkspaceWidthClass;
};

type WorkspaceTranslator = ReturnType<typeof useTranslations<"relationships.workspace">>;

export function GraphNetworkPanel({
  hasSelection,
  onClose,
  onRestoreFocus,
  target,
  widthClass,
  ...content
}: GraphNetworkPanelProps) {
  const t = useTranslations("relationships.workspace");
  const text = target === null ? null : toPanelText({ t, target });

  return (
    <GraphDetailsPanel
      appearance="person"
      autoFocus={hasSelection}
      heading={text?.heading}
      onClose={onClose}
      onRestoreFocus={onRestoreFocus}
      open={target !== null}
      title={text?.title ?? t("panel.title")}
      widthClass={widthClass}
    >
      {target === null ? null : <GraphNetworkPanelContent {...content} target={target} />}
    </GraphDetailsPanel>
  );
}

function toPanelText({ t, target }: { t: WorkspaceTranslator; target: GraphNetworkPanelTarget }): {
  heading: string;
  title: string;
} {
  switch (target.kind) {
    case "aggregate":
      return {
        heading: t("network.panel.heading.aggregate"),
        title: t("networkPanel.aggregate.title", {
          source: target.sourceLabel,
          target: target.targetLabel,
        }),
      };
    case "character":
      return { heading: t("panel.person.heading.character"), title: target.node.displayName };
    case "connection":
      return {
        heading: t("panel.person.heading.connection"),
        title: t("panel.connection.title", {
          source: target.first.displayName,
          target: target.second.displayName,
        }),
      };
    case "members":
      return {
        heading: t("network.panel.heading.members"),
        title: t("networkPanel.members.label", { name: target.label }),
      };
    default:
      return assertNever(target);
  }
}
