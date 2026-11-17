import type { BookView } from "@app/shared";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { TransactionRunner } from "../../../core/database/transaction-runner.js";
import type { LoanContactResolver } from "../../loans/index.js";
import type { UserSettingsContextService } from "../../profile/index.js";
import type { BooksRepository, BookWithRelations } from "../infrastructure/books.repository.js";
import type { BookViewAssembler } from "./book-view-assembler.js";

import { parseIsoDate } from "../../../core/iso-date.js";
import { fakeOf } from "../../../test/fake.js";
import { BookLoanService } from "./book-loan.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const BOOK_ID = "22222222-2222-4222-8222-222222222222";
const KYIV_READER_PAST_MIDNIGHT = new Date("2026-11-16T23:00:00.000Z");

function setup({
  expectedReturnDate,
  readerToday,
}: {
  expectedReturnDate: Date;
  readerToday: Date;
}) {
  const activeLoan = fakeOf<BookWithRelations["loans"][number]>({
    expectedReturnDate,
    remindBeforeDays: null,
    remindToReturn: false,
  });
  const findOwnedByIdOrThrow = vi
    .fn<BooksRepository["findOwnedByIdOrThrow"]>()
    .mockResolvedValue(fakeOf<BookWithRelations>({ loans: [activeLoan] }));
  const updateActiveLoanSchedule = vi
    .fn<BooksRepository["updateActiveLoanSchedule"]>()
    .mockResolvedValue(undefined);
  const loadView = vi
    .fn<BookViewAssembler["loadView"]>()
    .mockResolvedValue(fakeOf<BookView>({ id: BOOK_ID }));
  const calendarDay = vi
    .fn<UserSettingsContextService["calendarDay"]>()
    .mockResolvedValue(readerToday);

  const service = new BookLoanService(
    fakeOf<BooksRepository>({ findOwnedByIdOrThrow, updateActiveLoanSchedule }),
    fakeOf<BookViewAssembler>({ loadView }),
    fakeOf<TransactionRunner>({}),
    fakeOf<LoanContactResolver>({}),
    fakeOf<UserSettingsContextService>({ calendarDay }),
  );

  return { calendarDay, service, updateActiveLoanSchedule };
}

describe("BookLoanService.extendLoan", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("extends an overdue loan from the reader's calendar day while UTC is still on the due day", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(KYIV_READER_PAST_MIDNIGHT);
    const { calendarDay, service, updateActiveLoanSchedule } = setup({
      expectedReturnDate: parseIsoDate("2026-11-16"),
      readerToday: new Date("2026-11-17T00:00:00.000Z"),
    });

    await service.extendLoan(USER_ID, BOOK_ID, { days: 7 });

    expect(updateActiveLoanSchedule).toHaveBeenCalledWith(
      USER_ID,
      BOOK_ID,
      expect.objectContaining({ expectedReturnDate: new Date("2026-11-24T00:00:00.000Z") }),
    );
    expect(calendarDay).toHaveBeenCalledWith({ now: expect.any(Date), userId: USER_ID });
  });
});
