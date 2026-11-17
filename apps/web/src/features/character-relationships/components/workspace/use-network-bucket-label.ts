"use client";

import { useTranslations } from "next-intl";

import { assertNever } from "@/lib/assert-never";

import type { NetworkBucketLabel } from "../../model/workspace/graph-network-scene";

export function useNetworkBucketLabel(): (label: NetworkBucketLabel) => string {
  const t = useTranslations("relationships.workspace.cluster");
  const tImportance = useTranslations("characters.importance");

  return (label) => {
    switch (label.kind) {
      case "fragment":
        return t("fragment", { index: label.index });
      case "group":
        return label.name ?? t("groupHidden");
      case "importance":
        return label.importance === null ? t("importanceUnknown") : tImportance(label.importance);
      case "ungrouped":
        return t("ungrouped");
      default:
        return assertNever(label);
    }
  };
}
