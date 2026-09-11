import type { QuotesOverviewView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { QuotePostFinishService } from "./quote-post-finish.service.js";
import { QuoteRediscoveryService } from "./quote-rediscovery.service.js";

@Injectable()
export class QuotesOverviewService {
  constructor(
    private readonly postFinishService: QuotePostFinishService,
    private readonly rediscoveryService: QuoteRediscoveryService,
  ) {}

  async overview({ userId }: { userId: string }): Promise<QuotesOverviewView> {
    const [memoryQuote, postFinish] = await Promise.all([
      this.rediscoveryService.selectMemoryQuote({ userId }),
      this.postFinishService.selectPostFinish({ userId }),
    ]);

    return { memoryQuote, postFinish };
  }
}
