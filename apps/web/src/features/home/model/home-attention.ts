import type {
  HomeAttentionGroup,
  HomeAttentionSeverity,
  HomeAttentionView,
  Nullable,
} from "@app/shared";

import { HOME_DASHBOARD_RULES } from "@app/shared";

import type { UiIconName } from "@/components/icons";

import type { HomePresence } from "./home-onboarding";

export type HomeAttentionCardState =
  | { kind: "error" }
  | { kind: "hidden" }
  | { kind: "list"; list: HomeAttentionList }
  | { kind: "loading" };

export type HomeAttentionList = {
  hidden: readonly HomeAttentionGroup[];
  isIncomplete: boolean;
  visible: readonly HomeAttentionGroup[];
};

export const HOME_ATTENTION_SEVERITY = {
  critical: { icon: "alert-triangle", tone: "text-error" },
  high: { icon: "alert-circle", tone: "text-warning" },
  low: { icon: "info", tone: "text-muted-foreground" },
  medium: { icon: "clock", tone: "text-info" },
} as const satisfies Record<HomeAttentionSeverity, { icon: UiIconName; tone: string }>;

export function homeAttentionCardState({
  data,
  isError,
}: {
  data: HomeAttentionView | undefined;
  isError: boolean;
}): HomeAttentionCardState {
  if (data === undefined) return isError ? { kind: "error" } : { kind: "loading" };

  const banner = homeCriticalBanner(data);
  const remaining = data.groups.filter((group) => group !== banner);
  const isIncomplete = data.unavailableSources.length > 0;
  if (remaining.length === 0 && !isIncomplete) return { kind: "hidden" };

  const { visibleGroups } = HOME_DASHBOARD_RULES.attention;
  return {
    kind: "list",
    list: {
      hidden: remaining.slice(visibleGroups),
      isIncomplete,
      visible: remaining.slice(0, visibleGroups),
    },
  };
}

export function homeAttentionPresence(data: HomeAttentionView | undefined): HomePresence {
  if (data === undefined) return "unknown";
  if (data.groups.length > 0) return "present";
  return data.unavailableSources.length > 0 ? "unknown" : "absent";
}

export function homeCriticalBanner(
  view: HomeAttentionView | undefined,
): Nullable<HomeAttentionGroup> {
  return view?.groups.find((group) => group.severity === "critical") ?? null;
}
