import type { Nullable, QuoteRediscoveryImpressionInput, QuoteView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { QuoteRediscoveryCandidate } from "../domain/quote-rediscovery.js";
import type {
  QuoteLastShownRow,
  QuoteRediscoveryCandidateRow,
} from "../infrastructure/quote-rediscovery.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { parseIsoDate, toIsoDate, toZonedIsoDate } from "../../../core/iso-date.js";
import { MediaService } from "../../media/index.js";
import { UserSettingsContextService } from "../../profile/index.js";
import {
  QUOTE_REDISCOVERY_POLICY,
  rediscoveryCreationCutoff,
  selectRediscoveryQuoteId,
} from "../domain/quote-rediscovery.js";
import { toQuoteView } from "../domain/quote.mapper.js";
import { QuoteRediscoveryRepository } from "../infrastructure/quote-rediscovery.repository.js";
import { QuotesRepository } from "../infrastructure/quotes.repository.js";

const QUOTE_NOT_REDISCOVERABLE_MESSAGE = "Quote is not available for rediscovery";

type LocalDay = {
  localDate: string;
  timeZone: string;
};

@Injectable()
export class QuoteRediscoveryService {
  constructor(
    private readonly mediaService: MediaService,
    private readonly quotesRepository: QuotesRepository,
    private readonly rediscoveryRepository: QuoteRediscoveryRepository,
    private readonly userSettingsContextService: UserSettingsContextService,
  ) {}

  async recordImpression({
    input,
    userId,
  }: {
    input: QuoteRediscoveryImpressionInput;
    userId: string;
  }): Promise<void> {
    const now = new Date();
    const { localDate, timeZone } = await this.resolveLocalDay({ now, userId });

    const eligibleCount = await this.rediscoveryRepository.countEligible({
      createdBefore: rediscoveryCreationCutoff({ localDate, timeZone }),
      quoteId: input.quoteId,
      userId,
    });
    if (eligibleCount === 0) {
      throw new NotFoundError(QUOTE_NOT_REDISCOVERABLE_MESSAGE);
    }

    await this.rediscoveryRepository.recordImpression({
      quoteId: input.quoteId,
      shownAt: now,
      shownOn: parseIsoDate(localDate),
      userId,
    });
  }

  async selectMemoryQuote({ userId }: { userId: string }): Promise<Nullable<QuoteView>> {
    const now = new Date();
    const { localDate, timeZone } = await this.resolveLocalDay({ now, userId });
    const shownOn = parseIsoDate(localDate);

    const [candidateRows, lastShownRows, todaysImpressions] = await Promise.all([
      this.rediscoveryRepository.listEligibleCandidates({
        createdBefore: rediscoveryCreationCutoff({ localDate, timeZone }),
        userId,
      }),
      this.rediscoveryRepository.listLastShownDates(userId),
      this.rediscoveryRepository.listImpressionsOn({ shownOn, userId }),
    ]);

    if (candidateRows.length < QUOTE_REDISCOVERY_POLICY.minimumCandidates) {
      return null;
    }

    const candidates = toCandidates({ candidateRows, lastShownRows, timeZone });
    const eligibleIds = new Set(candidates.map((candidate) => candidate.id));
    const reused = todaysImpressions.find((impression) => eligibleIds.has(impression.quoteId));

    const quoteId = reused?.quoteId ?? selectRediscoveryQuoteId({ candidates, localDate, userId });
    if (quoteId === null) {
      return null;
    }

    return this.hydrate({ quoteId, userId });
  }

  private async hydrate({
    quoteId,
    userId,
  }: {
    quoteId: string;
    userId: string;
  }): Promise<Nullable<QuoteView>> {
    const quote = await this.quotesRepository.findOwnedQuoteById({ quoteId, userId });
    if (quote === null) {
      return null;
    }
    return toQuoteView({ cover: this.mediaService.buildViewOrNull(quote.book.coverMedia), quote });
  }

  private async resolveLocalDay({ now, userId }: { now: Date; userId: string }): Promise<LocalDay> {
    const { timezone } = await this.userSettingsContextService.resolve(userId);
    return { localDate: toZonedIsoDate({ instant: now, timeZone: timezone }), timeZone: timezone };
  }
}

function toCandidates({
  candidateRows,
  lastShownRows,
  timeZone,
}: {
  candidateRows: QuoteRediscoveryCandidateRow[];
  lastShownRows: QuoteLastShownRow[];
  timeZone: string;
}): QuoteRediscoveryCandidate[] {
  const lastShownByQuoteId = new Map(
    lastShownRows.map((row) => [row.quoteId, toIsoDate(row.lastShownOn)]),
  );

  return candidateRows.map((row) => ({
    createdOn: toZonedIsoDate({ instant: row.createdAt, timeZone }),
    hasComment: row.hasComment,
    id: row.id,
    isFavorite: row.isFavorite,
    lastShownOn: lastShownByQuoteId.get(row.id) ?? null,
  }));
}
