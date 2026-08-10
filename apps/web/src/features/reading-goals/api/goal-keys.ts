const GOALS_ROOT = "/api/goals";

export const goalKeys = {
  detail: (goalId: string) => [GOALS_ROOT, "detail", goalId] as const,
  forList: (listId: string) => [GOALS_ROOT, "for-list", listId] as const,
  root: [GOALS_ROOT] as const,
};
