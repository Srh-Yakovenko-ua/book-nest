import { describe, expect, it, vi } from "vitest";

import type { MediaService } from "../../media/index.js";
import type { UserSettingsContextService } from "../../profile/index.js";
import type { PostFinishCandidate } from "../domain/quote-post-finish.js";
import type {
  PostFinishBookRow,
  PostFinishQuoteCountsRow,
  QuotePostFinishRepository,
} from "../infrastructure/quote-post-finish.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { parseIsoDate } from "../../../core/iso-date.js";
import { fakeOf } from "../../../test/fake.js";
import { QuotePostFinishService } from "./quote-post-finish.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const TODAY = "2026-09-10";
const WINDOW_START = "2026-08-11";
const QUOTED_BOOK_ID = "22222222-2222-4222-8222-222222222222";
const EMPTY_BOOK_ID = "33333333-3333-4333-8333-333333333333";

type Harness = {
  postFinishRepository: {
    aggregateActiveQuoteCounts: ReturnType<typeof vi.fn>;
    countOwnedCycles: ReturnType<typeof vi.fn>;
    findBookPreview: ReturnType<typeof vi.fn>;
    listUnreviewedFinishedCycles: ReturnType<typeof vi.fn>;
    recordReview: ReturnType<typeof vi.fn>;
  };
  service: QuotePostFinishService;
};

function bookRow(): PostFinishBookRow {
  return fakeOf<PostFinishBookRow>({
    coverMedia: null,
    firstAuthorName: "Frank Herbert",
    id: QUOTED_BOOK_ID,
    title: "Dune",
  });
}

function buildHarness({
  candidates = [],
  counts = [],
  ownedCycles = 1,
}: {
  candidates?: PostFinishCandidate[];
  counts?: PostFinishQuoteCountsRow[];
  ownedCycles?: number;
} = {}): Harness {
  const postFinishRepository = {
    aggregateActiveQuoteCounts: vi.fn().mockResolvedValue(counts),
    countOwnedCycles: vi.fn().mockResolvedValue(ownedCycles),
    findBookPreview: vi.fn().mockResolvedValue(bookRow()),
    listUnreviewedFinishedCycles: vi.fn().mockResolvedValue(candidates),
    recordReview: vi.fn().mockResolvedValue(1),
  };

  const service = new QuotePostFinishService(
    fakeOf<MediaService>({ buildViewOrNull: vi.fn().mockReturnValue(null) }),
    fakeOf<QuotePostFinishRepository>(postFinishRepository),
    fakeOf<UserSettingsContextService>({ today: vi.fn().mockResolvedValue(TODAY) }),
  );

  return { postFinishRepository, service };
}

function candidate(
  id: string,
  { bookId = QUOTED_BOOK_ID, finishedOn }: { bookId?: string; finishedOn: string },
): PostFinishCandidate {
  return { bookId, finishedAt: parseIsoDate(finishedOn), id };
}

function countsRow(
  bookId: string,
  overrides: Partial<PostFinishQuoteCountsRow> = {},
): PostFinishQuoteCountsRow {
  return {
    bookId,
    favoritesCount: 1,
    quotesCount: 4,
    withCommentCount: 2,
    ...overrides,
  };
}

describe("QuotePostFinishService.selectPostFinish", () => {
  it("asks the repository for the thirty-day window of the reader's own day", async () => {
    const { postFinishRepository, service } = buildHarness();

    await service.selectPostFinish({ userId: USER_ID });

    expect(postFinishRepository.listUnreviewedFinishedCycles).toHaveBeenCalledWith({
      finishedFrom: parseIsoDate(WINDOW_START),
      finishedTo: parseIsoDate(TODAY),
      userId: USER_ID,
    });
  });

  it("counts nothing while no cycle qualifies", async () => {
    const { postFinishRepository, service } = buildHarness();

    await expect(service.selectPostFinish({ userId: USER_ID })).resolves.toBeNull();
    expect(postFinishRepository.aggregateActiveQuoteCounts).not.toHaveBeenCalled();
  });

  it("serves the recap of the most recently finished cycle", async () => {
    const { service } = buildHarness({
      candidates: [
        candidate("cycle-older", { finishedOn: "2026-08-20" }),
        candidate("cycle-latest", { finishedOn: "2026-09-08" }),
      ],
      counts: [countsRow(QUOTED_BOOK_ID)],
    });

    await expect(service.selectPostFinish({ userId: USER_ID })).resolves.toEqual({
      book: { cover: null, firstAuthorName: "Frank Herbert", id: QUOTED_BOOK_ID, title: "Dune" },
      favoritesCount: 1,
      finishedAt: "2026-09-08",
      quotesCount: 4,
      readingCycleId: "cycle-latest",
      withCommentCount: 2,
    });
  });

  it("skips a cycle whose book holds no active quote", async () => {
    const { service } = buildHarness({
      candidates: [
        candidate("cycle-quoted", { finishedOn: "2026-08-20" }),
        candidate("cycle-empty", { bookId: EMPTY_BOOK_ID, finishedOn: "2026-09-08" }),
      ],
      counts: [countsRow(QUOTED_BOOK_ID), countsRow(EMPTY_BOOK_ID, { quotesCount: 0 })],
    });

    const postFinish = await service.selectPostFinish({ userId: USER_ID });

    expect(postFinish?.readingCycleId).toBe("cycle-quoted");
  });

  it("breaks a tie on the same day by the smaller cycle id", async () => {
    const { service } = buildHarness({
      candidates: [
        candidate("cycle-b", { finishedOn: "2026-09-08" }),
        candidate("cycle-a", { finishedOn: "2026-09-08" }),
      ],
      counts: [countsRow(QUOTED_BOOK_ID)],
    });

    const postFinish = await service.selectPostFinish({ userId: USER_ID });

    expect(postFinish?.readingCycleId).toBe("cycle-a");
  });

  it("asks for the book preview of the selected cycle only", async () => {
    const { postFinishRepository, service } = buildHarness({
      candidates: [
        candidate("cycle-quoted", { finishedOn: "2026-08-20" }),
        candidate("cycle-empty", { bookId: EMPTY_BOOK_ID, finishedOn: "2026-09-08" }),
      ],
      counts: [countsRow(QUOTED_BOOK_ID), countsRow(EMPTY_BOOK_ID, { quotesCount: 0 })],
    });

    await service.selectPostFinish({ userId: USER_ID });

    expect(postFinishRepository.findBookPreview).toHaveBeenCalledTimes(1);
    expect(postFinishRepository.findBookPreview).toHaveBeenCalledWith({
      bookId: QUOTED_BOOK_ID,
      userId: USER_ID,
    });
  });

  it("writes nothing while serving the recap", async () => {
    const { postFinishRepository, service } = buildHarness({
      candidates: [candidate("cycle-latest", { finishedOn: "2026-09-08" })],
      counts: [countsRow(QUOTED_BOOK_ID)],
    });

    await service.selectPostFinish({ userId: USER_ID });

    expect(postFinishRepository.recordReview).not.toHaveBeenCalled();
  });
});

describe("QuotePostFinishService.recordReview", () => {
  it("refuses a reading cycle the reader does not own", async () => {
    const { postFinishRepository, service } = buildHarness({ ownedCycles: 0 });

    await expect(
      service.recordReview({ input: { readingCycleId: "cycle-latest" }, userId: USER_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(postFinishRepository.recordReview).not.toHaveBeenCalled();
  });

  it("stores the review against the supplied cycle", async () => {
    const { postFinishRepository, service } = buildHarness();

    await service.recordReview({ input: { readingCycleId: "cycle-latest" }, userId: USER_ID });

    expect(postFinishRepository.recordReview).toHaveBeenCalledWith({
      readingCycleId: "cycle-latest",
      reviewedAt: expect.any(Date),
      userId: USER_ID,
    });
  });
});
