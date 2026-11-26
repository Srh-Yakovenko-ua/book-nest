import { describe, expect, it } from "vitest";

import { createGoalFormSchema, reachesTargetOnCreation, toCreationPreviewQuery } from "./goal-form";

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

describe("toCreationPreviewQuery", () => {
  const PREVIEW_TODAY = "2026-08-15";

  it("sends a deadline that falls after the reader's current day", () => {
    expect(toCreationPreviewQuery({ deadline: "2026-08-16", today: PREVIEW_TODAY })).toEqual({
      deadline: "2026-08-16",
    });
  });

  it.each([
    { case: "an empty deadline", deadline: "" },
    { case: "the reader's current day", deadline: "2026-08-15" },
    { case: "a day before the reader's current day", deadline: "2026-08-14" },
    { case: "a day that is not zero-padded", deadline: "2026-8-16" },
    { case: "a day that does not exist", deadline: "2026-02-30" },
  ])("leaves the deadline out for $case", ({ deadline }) => {
    expect(toCreationPreviewQuery({ deadline, today: PREVIEW_TODAY })).toEqual({});
  });
});

describe("reachesTargetOnCreation", () => {
  it("reports a goal whose target equals the counted books as already reached", () => {
    expect(reachesTargetOnCreation({ countedCount: 3, targetCount: 3 })).toBe(true);
  });

  it("reports a goal whose target is below the counted books as already reached", () => {
    expect(reachesTargetOnCreation({ countedCount: 3, targetCount: 2 })).toBe(true);
  });

  it("does not report a goal whose target is above the counted books", () => {
    expect(reachesTargetOnCreation({ countedCount: 3, targetCount: 4 })).toBe(false);
  });

  it.each([
    { case: "a missing target", countedCount: 3, targetCount: Number.NaN },
    { case: "a zero target", countedCount: 3, targetCount: 0 },
    { case: "a fractional target", countedCount: 2, targetCount: 1.5 },
  ])("does not report $case as reached", ({ countedCount, targetCount }) => {
    expect(reachesTargetOnCreation({ countedCount, targetCount })).toBe(false);
  });
});
