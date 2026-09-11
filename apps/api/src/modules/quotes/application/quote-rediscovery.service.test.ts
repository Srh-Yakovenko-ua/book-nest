import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MediaService } from "../../media/index.js";
import type { UserSettingsContextService } from "../../profile/index.js";
import type {
  QuoteLastShownRow,
  QuoteRediscoveryCandidateRow,
} from "../infrastructure/quote-rediscovery.repository.js";
import type { QuoteRediscoveryRepository } from "../infrastructure/quote-rediscovery.repository.js";
import type { QuotesRepository, QuoteWithBook } from "../infrastructure/quotes.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { addDaysToIsoDate, parseIsoDate } from "../../../core/iso-date.js";
import { fakeOf } from "../../../test/fake.js";
import { QuoteRediscoveryService } from "./quote-rediscovery.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const BOOK_ID = "44444444-4444-4444-8444-444444444444";
const TODAY = "2026-09-10";
const NOW = new Date("2026-09-10T09:30:00.000Z");

type Harness = {
  mediaService: { buildViewOrNull: ReturnType<typeof vi.fn> };
  quotesRepository: { findOwnedQuoteById: ReturnType<typeof vi.fn> };
  rediscoveryRepository: {
    countEligible: ReturnType<typeof vi.fn>;
    listEligibleCandidates: ReturnType<typeof vi.fn>;
    listImpressionsOn: ReturnType<typeof vi.fn>;
    listLastShownDates: ReturnType<typeof vi.fn>;
    recordImpression: ReturnType<typeof vi.fn>;
  };
  service: QuoteRediscoveryService;
};

function buildHarness({
  candidates = [],
  impressionsToday = [],
  lastShown = [],
}: {
  candidates?: QuoteRediscoveryCandidateRow[];
  impressionsToday?: { quoteId: string }[];
  lastShown?: QuoteLastShownRow[];
} = {}): Harness {
  const rediscoveryRepository = {
    countEligible: vi.fn().mockResolvedValue(1),
    listEligibleCandidates: vi.fn().mockResolvedValue(candidates),
    listImpressionsOn: vi.fn().mockResolvedValue(impressionsToday),
    listLastShownDates: vi.fn().mockResolvedValue(lastShown),
    recordImpression: vi.fn().mockResolvedValue(1),
  };
  const quotesRepository = {
    findOwnedQuoteById: vi
      .fn()
      .mockImplementation(({ quoteId }: { quoteId: string }) =>
        Promise.resolve(quoteRow({ id: quoteId })),
      ),
  };
  const mediaService = { buildViewOrNull: vi.fn().mockReturnValue(null) };

  const service = new QuoteRediscoveryService(
    fakeOf<MediaService>(mediaService),
    fakeOf<QuotesRepository>(quotesRepository),
    fakeOf<QuoteRediscoveryRepository>(rediscoveryRepository),
    fakeOf<UserSettingsContextService>({
      resolve: vi.fn().mockResolvedValue({ timezone: "UTC", weekStartDay: "monday" }),
    }),
  );

  return { mediaService, quotesRepository, rediscoveryRepository, service };
}

function candidateRow(
  id: string,
  overrides: Partial<QuoteRediscoveryCandidateRow> = {},
): QuoteRediscoveryCandidateRow {
  return {
    createdAt: parseIsoDate(addDaysToIsoDate(TODAY, -400)),
    hasComment: false,
    id,
    isFavorite: false,
    ...overrides,
  };
}

function quoteRow(overrides: Partial<QuoteWithBook> = {}): QuoteWithBook {
  return fakeOf<QuoteWithBook>({
    bookId: BOOK_ID,
    chapter: null,
    comment: null,
    createdAt: NOW,
    id: "quote-a",
    isFavorite: false,
    isSpoiler: false,
    page: null,
    text: "Fear is the mind-killer",
    updatedAt: NOW,
    ...overrides,
    book: fakeOf<QuoteWithBook["book"]>({
      coverMedia: null,
      firstAuthorName: "Frank Herbert",
      id: BOOK_ID,
      title: "Dune",
    }),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("QuoteRediscoveryService.selectMemoryQuote", () => {
  it("returns null when the archive holds no eligible quote", async () => {
    const { quotesRepository, service } = buildHarness({ candidates: [] });

    await expect(service.selectMemoryQuote({ userId: USER_ID })).resolves.toBeNull();
    expect(quotesRepository.findOwnedQuoteById).not.toHaveBeenCalled();
  });

  it("returns null when a single eligible quote would repeat forever", async () => {
    const { service } = buildHarness({ candidates: [candidateRow("quote-a")] });

    await expect(service.selectMemoryQuote({ userId: USER_ID })).resolves.toBeNull();
  });

  it("hydrates the canonical view of the picked quote", async () => {
    const { service } = buildHarness({
      candidates: [candidateRow("quote-a"), candidateRow("quote-b")],
    });

    const memoryQuote = await service.selectMemoryQuote({ userId: USER_ID });

    expect(memoryQuote).toMatchObject({
      book: { firstAuthorName: "Frank Herbert", title: "Dune" },
      bookId: BOOK_ID,
      isSpoiler: false,
      text: "Fear is the mind-killer",
    });
  });

  it("repeats the same choice while the dataset is unchanged", async () => {
    const { service } = buildHarness({
      candidates: [candidateRow("quote-a"), candidateRow("quote-b"), candidateRow("quote-c")],
    });

    const first = await service.selectMemoryQuote({ userId: USER_ID });
    const second = await service.selectMemoryQuote({ userId: USER_ID });

    expect(first?.id).toBe(second?.id);
  });

  it("reuses today's impression when its quote is still eligible", async () => {
    const { service } = buildHarness({
      candidates: [
        candidateRow("quote-a"),
        candidateRow("quote-b"),
        candidateRow("quote-c"),
        candidateRow("quote-d"),
      ],
      impressionsToday: [{ quoteId: "quote-d" }],
    });

    const memoryQuote = await service.selectMemoryQuote({ userId: USER_ID });

    expect(memoryQuote?.id).toBe("quote-d");
  });

  it("ignores today's impression once its quote stopped being eligible", async () => {
    const { service } = buildHarness({
      candidates: [candidateRow("quote-a"), candidateRow("quote-b")],
      impressionsToday: [{ quoteId: "quote-gone" }],
    });

    const memoryQuote = await service.selectMemoryQuote({ userId: USER_ID });

    expect(memoryQuote?.id).not.toBe("quote-gone");
    expect(["quote-a", "quote-b"]).toContain(memoryQuote?.id);
  });

  it("prefers the most recent still-eligible impression of the day", async () => {
    const { service } = buildHarness({
      candidates: [candidateRow("quote-a"), candidateRow("quote-b")],
      impressionsToday: [{ quoteId: "quote-gone" }, { quoteId: "quote-a" }],
    });

    const memoryQuote = await service.selectMemoryQuote({ userId: USER_ID });

    expect(memoryQuote?.id).toBe("quote-a");
  });

  it("returns null when the picked quote disappeared before hydration", async () => {
    const { quotesRepository, service } = buildHarness({
      candidates: [candidateRow("quote-a"), candidateRow("quote-b")],
    });
    quotesRepository.findOwnedQuoteById.mockResolvedValue(null);

    await expect(service.selectMemoryQuote({ userId: USER_ID })).resolves.toBeNull();
  });

  it("never writes an impression while reading the overview", async () => {
    const { rediscoveryRepository, service } = buildHarness({
      candidates: [candidateRow("quote-a"), candidateRow("quote-b")],
    });

    await service.selectMemoryQuote({ userId: USER_ID });

    expect(rediscoveryRepository.recordImpression).not.toHaveBeenCalled();
  });

  it("asks the repository for the reader's own local creation cutoff", async () => {
    const { rediscoveryRepository, service } = buildHarness({
      candidates: [candidateRow("quote-a"), candidateRow("quote-b")],
    });

    await service.selectMemoryQuote({ userId: USER_ID });

    expect(rediscoveryRepository.listEligibleCandidates).toHaveBeenCalledWith({
      createdBefore: parseIsoDate("2026-08-12"),
      userId: USER_ID,
    });
  });

  it("carries the last impression date into the cooldown decision", async () => {
    const { service } = buildHarness({
      candidates: [candidateRow("quote-a"), candidateRow("quote-b")],
      lastShown: [{ lastShownOn: parseIsoDate(addDaysToIsoDate(TODAY, -1)), quoteId: "quote-a" }],
    });

    const memoryQuote = await service.selectMemoryQuote({ userId: USER_ID });

    expect(memoryQuote?.id).toBe("quote-b");
  });
});

describe("QuoteRediscoveryService.recordImpression", () => {
  it("stores the impression on the reader's local day", async () => {
    const { rediscoveryRepository, service } = buildHarness();

    await service.recordImpression({ input: { quoteId: "quote-a" }, userId: USER_ID });

    expect(rediscoveryRepository.recordImpression).toHaveBeenCalledWith({
      quoteId: "quote-a",
      shownAt: NOW,
      shownOn: parseIsoDate(TODAY),
      userId: USER_ID,
    });
  });

  it("rejects a quote that is no longer rediscoverable and writes nothing", async () => {
    const { rediscoveryRepository, service } = buildHarness();
    rediscoveryRepository.countEligible.mockResolvedValue(0);

    await expect(
      service.recordImpression({ input: { quoteId: "quote-a" }, userId: USER_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(rediscoveryRepository.recordImpression).not.toHaveBeenCalled();
  });

  it("checks eligibility against the current reader only", async () => {
    const { rediscoveryRepository, service } = buildHarness();

    await service.recordImpression({ input: { quoteId: "quote-a" }, userId: USER_ID });

    expect(rediscoveryRepository.countEligible).toHaveBeenCalledWith({
      createdBefore: parseIsoDate("2026-08-12"),
      quoteId: "quote-a",
      userId: USER_ID,
    });
  });
});
