import { describe, expect, it } from "vitest";

import { pinProcessTimezone } from "../../../test/process-timezone.js";
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

  describe("Atlantic/Azores", () => {
    pinProcessTimezone("Atlantic/Azores");

    it("returns return_soon for a return date seven days ahead across the spring clock change", () => {
      const status = getLoanUiStatus({
        expectedReturnDate: utc("2026-04-01"),
        today: utc("2026-03-25"),
      });

      expect(status).toBe("return_soon");
    });

    it("returns on_time for a return date eight days ahead across the autumn clock change", () => {
      const status = getLoanUiStatus({
        expectedReturnDate: utc("2026-10-28"),
        today: utc("2026-10-20"),
      });

      expect(status).toBe("on_time");
    });
  });
});

describe("loanDateBounds", () => {
  it("keeps the given calendar day as today", () => {
    const { today } = loanDateBounds(utc("2026-07-08"));

    expect(today.toISOString()).toBe("2026-07-08T00:00:00.000Z");
  });

  it("sets the soon window seven days after today", () => {
    const { soonEnd } = loanDateBounds(utc("2026-07-08"));

    expect(soonEnd.toISOString()).toBe("2026-07-15T00:00:00.000Z");
  });

  it("carries the soon window across a month boundary", () => {
    const { soonEnd } = loanDateBounds(utc("2026-11-28"));

    expect(soonEnd.toISOString()).toBe("2026-12-05T00:00:00.000Z");
  });

  describe("Europe/Kyiv", () => {
    pinProcessTimezone("Europe/Kyiv");

    it("keeps the soon window on 00:00 UTC across the spring clock change", () => {
      const { soonEnd } = loanDateBounds(utc("2026-03-25"));

      expect(soonEnd.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    });

    it("keeps the soon window on 00:00 UTC across the autumn clock change", () => {
      const { soonEnd } = loanDateBounds(utc("2026-10-20"));

      expect(soonEnd.toISOString()).toBe("2026-10-27T00:00:00.000Z");
    });
  });

  describe("America/New_York", () => {
    pinProcessTimezone("America/New_York");

    it("keeps the soon window on the seventh calendar day when the server is west of UTC", () => {
      const { soonEnd } = loanDateBounds(utc("2026-03-05"));

      expect(soonEnd.toISOString()).toBe("2026-03-12T00:00:00.000Z");
    });
  });
});
