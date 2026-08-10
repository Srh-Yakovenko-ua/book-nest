import type { CustomListDetail, Nullable } from "@app/shared";

import { ListDetailsControllerDetailTab } from "@/shared/api/generated/model";

import type { ListDetailQueryState, ListDetailStatus } from "./list-detail-query";

import { LIST_DETAIL_VALUES } from "./list-detail-query";

export type ListDetailTab = ListDetailsControllerDetailTab;

export type ListDetailTabCounts = CustomListDetail["statusCounts"];

export const LIST_DETAIL_TABS = LIST_DETAIL_VALUES.tab;

export function activeListDetailTab(state: ListDetailQueryState): Nullable<ListDetailTab> {
  return state.status.length === 0 ? state.tab : null;
}

export function listDetailStatusPatch(
  status: readonly ListDetailStatus[],
): { status: ListDetailStatus[]; tab: null } | { status: null } {
  if (status.length === 0) return { status: null };
  return { status: [...status], tab: null };
}

export function listDetailTabPatch(tab: ListDetailTab): {
  status: null;
  tab: Nullable<ListDetailTab>;
} {
  return { status: null, tab: tab === ListDetailsControllerDetailTab.all ? null : tab };
}
