import { describe, expect, it } from "vitest";

import type { LoansFilterInput } from "../infrastructure/loans.repository.js";

import { buildLoansFilter } from "./loans-filter.js";
import { buildLoansQuickCountFilters, clearLoansQuickFilterAxis } from "./loans-quick-counts.js";

const USER_ID = "user-1";
const CONTACT_ID = "11111111-1111-4111-8111-111111111111";
const TODAY = new Date("2026-09-24T00:00:00.000Z");
const SOON_END = new Date("2026-10-01T00:00:00.000Z");
const BOUNDS = { soonEnd: SOON_END, today: TODAY };

const FILTER_WITH_QUICK_AXIS: LoansFilterInput = {
  contactId: CONTACT_ID,
  expectedReturnDateFrom: null,
  expectedReturnDateTo: null,
  filter: "overdue",
  hasNote: true,
  loanDateFrom: null,
  loanDateTo: null,
  reminder: "off",
  search: "dune",
  soonEnd: SOON_END,
  today: TODAY,
  type: "lent_to_someone",
  userId: USER_ID,
};

const FILTER_WITHOUT_QUICK_AXIS: LoansFilterInput = { ...FILTER_WITH_QUICK_AXIS, filter: "all" };

describe("clearLoansQuickFilterAxis", () => {
  it("resets the quick filter to all and keeps everything else", () => {
    expect(clearLoansQuickFilterAxis(FILTER_WITH_QUICK_AXIS)).toEqual(FILTER_WITHOUT_QUICK_AXIS);
  });

  it("leaves the filter it was given untouched", () => {
    const original: LoansFilterInput = { ...FILTER_WITH_QUICK_AXIS };

    clearLoansQuickFilterAxis(original);

    expect(original).toEqual(FILTER_WITH_QUICK_AXIS);
  });
});

describe("buildLoansQuickCountFilters", () => {
  it("counts all over the filter with the selected quick filter cleared", () => {
    expect(buildLoansQuickCountFilters(FILTER_WITH_QUICK_AXIS).all).toEqual(
      FILTER_WITHOUT_QUICK_AXIS,
    );
  });

  it("sets the list filter of each chip on top of the cleared filter", () => {
    const filters = buildLoansQuickCountFilters(FILTER_WITH_QUICK_AXIS);

    expect(filters.overdue).toEqual({ ...FILTER_WITHOUT_QUICK_AXIS, filter: "overdue" });
    expect(filters.return_soon).toEqual({ ...FILTER_WITHOUT_QUICK_AXIS, filter: "return_soon" });
    expect(filters.no_return_date).toEqual({
      ...FILTER_WITHOUT_QUICK_AXIS,
      filter: "no_return_date",
    });
  });

  it("builds the same chips whichever quick filter was selected", () => {
    expect(
      buildLoansQuickCountFilters({ ...FILTER_WITH_QUICK_AXIS, filter: "return_soon" }),
    ).toEqual(buildLoansQuickCountFilters(FILTER_WITHOUT_QUICK_AXIS));
  });

  it("keeps the direction, the date window and the owner on every chip", () => {
    const filters = buildLoansQuickCountFilters(FILTER_WITH_QUICK_AXIS);

    for (const chipFilter of Object.values(filters)) {
      expect(chipFilter).toMatchObject({
        soonEnd: SOON_END,
        today: TODAY,
        type: "lent_to_someone",
        userId: USER_ID,
      });
    }
  });
});

describe("buildLoansFilter", () => {
  it("defaults the quick filter to all when the query carries none", () => {
    const filter = buildLoansFilter({ bounds: BOUNDS, query: {}, userId: USER_ID });

    expect(filter.filter).toBe("all");
  });

  it("keeps the quick filter a list query selects", () => {
    const filter = buildLoansFilter({
      bounds: BOUNDS,
      query: { filter: "no_return_date" },
      userId: USER_ID,
    });

    expect(filter.filter).toBe("no_return_date");
  });

  it("turns the query into the repository filter", () => {
    const filter = buildLoansFilter({
      bounds: BOUNDS,
      query: {
        contactId: CONTACT_ID,
        expectedReturnDateFrom: "2026-09-01",
        expectedReturnDateTo: "2026-09-30",
        hasNote: false,
        loanDateFrom: "2026-08-01",
        loanDateTo: "2026-08-31",
        reminder: "on",
        search: "  dune   messiah ",
        type: "borrowed_from_someone",
      },
      userId: USER_ID,
    });

    expect(filter).toEqual({
      contactId: CONTACT_ID,
      expectedReturnDateFrom: new Date("2026-09-01T00:00:00.000Z"),
      expectedReturnDateTo: new Date("2026-09-30T00:00:00.000Z"),
      filter: "all",
      hasNote: false,
      loanDateFrom: new Date("2026-08-01T00:00:00.000Z"),
      loanDateTo: new Date("2026-08-31T00:00:00.000Z"),
      reminder: "on",
      search: "dune messiah",
      soonEnd: SOON_END,
      today: TODAY,
      type: "borrowed_from_someone",
      userId: USER_ID,
    });
  });

  it("drops a blank search", () => {
    const filter = buildLoansFilter({ bounds: BOUNDS, query: { search: "   " }, userId: USER_ID });

    expect(filter.search).toBeUndefined();
  });
});
