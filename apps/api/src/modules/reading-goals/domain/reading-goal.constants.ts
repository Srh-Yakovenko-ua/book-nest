export const ACTIVE_LIST_GOAL_INDEX = "reading_goals_active_list_idx";

export const READING_GOAL_MESSAGE = {
  activeGoalExists: "This list already has an active reading goal",
  archivedIsReadOnly: "Archived goal cannot be changed",
  deadlineNotInFuture: "Deadline must be later than today",
  notFound: "Reading goal not found",
  targetAboveListSize: "Target cannot exceed the number of books in the list",
} as const;

export const READING_GOAL_LIMITS = Object.freeze({
  countedBooks: 100,
});
