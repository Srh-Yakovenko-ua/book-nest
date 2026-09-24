import { describe, expect, it } from "vitest";

import type { LoansQueryState } from "./loans-query";

import { LOANS_ADVANCED_EMPTY, toLoansListParams } from "./loans-query";
import { toLoansQuickCountsParams } from "./loans-quick-filters";

const CONTACT_ID = "11111111-1111-4111-8111-111111111111";

const BASE_STATE: LoansQueryState = {
  ...LOANS_ADVANCED_EMPTY,
  filter: "all",
  q: "",
  sort: "overdue_first",
};

describe("toLoansQuickCountsParams", () => {
  it("keeps the direction, search and advanced filters the list sends", () => {
    const listParams = toLoansListParams(
      {
        ...BASE_STATE,
        contactId: CONTACT_ID,
        dueFrom: "2026-08-01",
        dueTo: "2026-08-31",
        hasNote: true,
        loanFrom: "2026-07-01",
        loanTo: "2026-07-31",
        q: "  дюна  ",
        reminder: "off",
      },
      "lent_to_someone",
    );

    expect(toLoansQuickCountsParams(listParams)).toEqual({
      contactId: CONTACT_ID,
      expectedReturnDateFrom: "2026-08-01",
      expectedReturnDateTo: "2026-08-31",
      hasNote: "true",
      loanDateFrom: "2026-07-01",
      loanDateTo: "2026-07-31",
      reminder: "off",
      search: "дюна",
      type: "lent_to_someone",
    });
  });

  it("drops paging, sort and the selected quick filter", () => {
    const listParams = toLoansListParams(
      { ...BASE_STATE, filter: "overdue", sort: "title" },
      "borrowed_from_someone",
    );

    expect(toLoansQuickCountsParams(listParams)).toEqual({ type: "borrowed_from_someone" });
  });

  it("leaves out an inverted range the list leaves out", () => {
    const listParams = toLoansListParams(
      { ...BASE_STATE, loanFrom: "2026-07-31", loanTo: "2026-07-01" },
      "lent_to_someone",
    );

    const params = toLoansQuickCountsParams(listParams);

    expect(params).not.toHaveProperty("loanDateFrom");
    expect(params).not.toHaveProperty("loanDateTo");
  });
});
