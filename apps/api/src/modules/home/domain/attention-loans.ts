import type {
  HomeAttentionGroup,
  HomeAttentionSeverity,
  LoanDirectionSummary,
  LoanType,
} from "@app/shared";

export type LoanDirectionAttention = Pick<
  LoanDirectionSummary,
  "nearestReturnDate" | "oldestOverdueReturnDate" | "overdueCount" | "returningSoonCount"
>;

const LOAN_SEVERITY: Record<LoanType, HomeAttentionSeverity> = {
  borrowed_from_someone: "high",
  lent_to_someone: "medium",
};

export function buildLoanAttention({
  borrowed,
  lent,
}: {
  borrowed: LoanDirectionAttention;
  lent: LoanDirectionAttention;
}): HomeAttentionGroup[] {
  return [
    ...buildDirectionGroups({ direction: "borrowed_from_someone", summary: borrowed }),
    ...buildDirectionGroups({ direction: "lent_to_someone", summary: lent }),
  ];
}

function buildDirectionGroups({
  direction,
  summary,
}: {
  direction: LoanType;
  summary: LoanDirectionAttention;
}): HomeAttentionGroup[] {
  const severity = LOAN_SEVERITY[direction];
  const groups: HomeAttentionGroup[] = [];

  if (summary.overdueCount > 0) {
    groups.push({
      count: summary.overdueCount,
      direction,
      dueDate: summary.oldestOverdueReturnDate,
      id: `loan_overdue:${direction}`,
      reason: "loan_overdue",
      severity,
      unit: "books",
    });
  }
  if (summary.returningSoonCount > 0) {
    groups.push({
      count: summary.returningSoonCount,
      direction,
      dueDate: summary.nearestReturnDate,
      id: `loan_return_soon:${direction}`,
      reason: "loan_return_soon",
      severity,
      unit: "books",
    });
  }
  return groups;
}
