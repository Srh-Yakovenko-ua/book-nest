import { describe, expect, it } from "vitest";

import { getLoanUiStatus, loanDateBounds } from "./loan-ui-status.js";

const TODAY = new Date("2026-07-08T00:00:00.000Z");
const utc = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

describe("getLoanUiStatus", () => {
  it("returns no_return_date when there is no expected return date", () => {
    expect(getLoanUiStatus({ expectedReturnDate: null, today: TODAY })).toBe("no_return_date");
  });

  it("returns overdue when the return date is before today", () => {
    expect(getLoanUiStatus({ expectedReturnDate: utc("2026-07-07"), today: TODAY })).toBe(
      "overdue",
    );
  });

  it("returns return_soon when the return date is today", () => {
    expect(getLoanUiStatus({ expectedReturnDate: utc("2026-07-08"), today: TODAY })).toBe(
      "return_soon",
    );
  });

  it("returns return_soon when the return date is within seven days", () => {
    expect(getLoanUiStatus({ expectedReturnDate: utc("2026-07-15"), today: TODAY })).toBe(
      "return_soon",
    );
  });

  it("returns on_time when the return date is more than seven days away", () => {
    expect(getLoanUiStatus({ expectedReturnDate: utc("2026-07-16"), today: TODAY })).toBe(
      "on_time",
    );
  });
});

describe("loanDateBounds", () => {
  it("derives a UTC-midnight today from the given instant", () => {
    const { today } = loanDateBounds(new Date("2026-07-08T15:30:00.000Z"));

    expect(today.toISOString()).toBe("2026-07-08T00:00:00.000Z");
  });

  it("sets the soon window seven days after today", () => {
    const { soonEnd } = loanDateBounds(new Date("2026-07-08T15:30:00.000Z"));

    expect(soonEnd.toISOString()).toBe("2026-07-15T00:00:00.000Z");
  });
});
