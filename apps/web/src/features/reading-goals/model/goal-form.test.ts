import { describe, expect, it } from "vitest";

import { createGoalFormSchema } from "./goal-form";

const MESSAGES = {
  deadlinePast: "deadline-past",
  nameMax: "name-max",
  required: "required",
  targetMax: "target-max",
  targetMin: "target-min",
} as const;

const TODAY = "2026-11-15";

function deadlineIssues({
  deadline,
  initialDeadline = "2026-12-31",
}: {
  deadline: string;
  initialDeadline?: string;
}) {
  const schema = createGoalFormSchema({
    bookCount: 10,
    initialDeadline,
    messages: MESSAGES,
    today: TODAY,
  });
  const result = schema.safeParse({ deadline, name: "", targetCount: 3 });
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("createGoalFormSchema deadline", () => {
  it("refuses the reader's current day", () => {
    expect(deadlineIssues({ deadline: TODAY })).toEqual([MESSAGES.deadlinePast]);
  });

  it("refuses a day before the reader's current day", () => {
    expect(deadlineIssues({ deadline: "2026-11-14" })).toEqual([MESSAGES.deadlinePast]);
  });

  it("accepts the day after the reader's current day", () => {
    expect(deadlineIssues({ deadline: "2026-11-16" })).toEqual([]);
  });

  it("keeps an unchanged deadline valid even after it has passed", () => {
    expect(deadlineIssues({ deadline: "2026-11-01", initialDeadline: "2026-11-01" })).toEqual([]);
  });
});
