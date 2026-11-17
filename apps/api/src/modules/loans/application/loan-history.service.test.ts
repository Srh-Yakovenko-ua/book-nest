import { describe, expect, it, vi } from "vitest";

import type { MediaService } from "../../media/index.js";
import type { UserSettingsContextService } from "../../profile/index.js";
import type {
  CompletedLoanWithBook,
  LoanHistoryRepository,
} from "../infrastructure/loan-history.repository.js";

import { BadRequestError } from "../../../core/exceptions/errors.js";
import { parseIsoDate } from "../../../core/iso-date.js";
import { fakeOf } from "../../../test/fake.js";
import { LoanHistoryService } from "./loan-history.service.js";

const LOAN_FIXTURE = {
  bookId: "33333333-3333-4333-8333-333333333333",
  contactId: "44444444-4444-4444-8444-444444444444",
  kyivTimeZone: "Europe/Kyiv",
  loanId: "22222222-2222-4222-8222-222222222222",
  returnedBeforeLoanMessage: "Returned date cannot be earlier than the loan date",
  userId: "11111111-1111-4111-8111-111111111111",
} as const;

function completedLoan(loanDate: string): CompletedLoanWithBook {
  return fakeOf<CompletedLoanWithBook>({
    book: fakeOf<CompletedLoanWithBook["book"]>({
      coverMedia: null,
      firstAuthorName: "Frank Herbert",
      id: LOAN_FIXTURE.bookId,
      originalTitle: null,
      ownershipStatus: "none",
      publisher: null,
      title: "Dune",
    }),
    contact: null,
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    expectedReturnDate: parseIsoDate("2026-02-20"),
    id: LOAN_FIXTURE.loanId,
    loanContact: { contact: null, id: LOAN_FIXTURE.contactId, name: "Olha" },
    loanDate: parseIsoDate(loanDate),
    note: null,
    returnedAt: new Date("2026-02-15T10:00:00.000Z"),
    type: "borrowed_from_someone",
    updatedAt: new Date("2026-02-15T10:00:00.000Z"),
  });
}

function correctReturnedDate(service: LoanHistoryService, returnedDate: string) {
  return service.correct({
    input: { returnedDate },
    loanId: LOAN_FIXTURE.loanId,
    userId: LOAN_FIXTURE.userId,
  });
}

function setup({ loanDate, timezone }: { loanDate: string; timezone: string }) {
  const findCompletedById = vi
    .fn<LoanHistoryRepository["findCompletedById"]>()
    .mockResolvedValue(completedLoan(loanDate));
  const correct = vi.fn<LoanHistoryRepository["correct"]>().mockResolvedValue(1);
  const resolve = vi
    .fn<UserSettingsContextService["resolve"]>()
    .mockResolvedValue({ timezone, weekStartDay: "monday" });

  const service = new LoanHistoryService(
    fakeOf<LoanHistoryRepository>({ correct, findCompletedById }),
    fakeOf<MediaService>({ buildViewOrNull: () => null }),
    fakeOf<UserSettingsContextService>({ resolve }),
  );

  return { correct, service };
}

describe("LoanHistoryService.correct returned date", () => {
  it("stores the corrected day as the start of that day in the Kyiv reader's zone", async () => {
    const { correct, service } = setup({
      loanDate: "2026-02-01",
      timezone: LOAN_FIXTURE.kyivTimeZone,
    });

    await correctReturnedDate(service, "2026-02-10");

    expect(correct).toHaveBeenCalledWith(
      expect.objectContaining({
        loanId: LOAN_FIXTURE.loanId,
        returnedAt: new Date("2026-02-09T22:00:00.000Z"),
      }),
    );
  });

  it("accepts a correction to the loan day itself for a Kyiv reader whose day starts before UTC midnight", async () => {
    const { correct, service } = setup({
      loanDate: "2026-02-10",
      timezone: LOAN_FIXTURE.kyivTimeZone,
    });

    await correctReturnedDate(service, "2026-02-10");

    expect(correct).toHaveBeenCalledWith(
      expect.objectContaining({ returnedAt: new Date("2026-02-09T22:00:00.000Z") }),
    );
  });

  it("rejects a corrected day one day before the loan day with the returned-before-loan error", async () => {
    const { service } = setup({
      loanDate: "2026-02-10",
      timezone: LOAN_FIXTURE.kyivTimeZone,
    });

    const rejection = correctReturnedDate(service, "2026-02-09");

    await expect(rejection).rejects.toThrow(BadRequestError);
    await expect(rejection).rejects.toThrow(LOAN_FIXTURE.returnedBeforeLoanMessage);
  });

  it("leaves the stored loan untouched when the corrected day is before the loan day", async () => {
    const { correct, service } = setup({
      loanDate: "2026-02-10",
      timezone: LOAN_FIXTURE.kyivTimeZone,
    });

    await expect(correctReturnedDate(service, "2026-02-09")).rejects.toThrow(BadRequestError);

    expect(correct).not.toHaveBeenCalled();
  });
});
