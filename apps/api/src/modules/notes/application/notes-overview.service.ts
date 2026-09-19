import type { BookNotesOverviewView, SeriesNotesOverviewView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { NotePostFinishService } from "./note-post-finish.service.js";
import { NoteRediscoveryService } from "./note-rediscovery.service.js";
import { SeriesBeforeContinuationService } from "./series-before-continuation.service.js";

@Injectable()
export class NotesOverviewService {
  constructor(
    private readonly beforeContinuationService: SeriesBeforeContinuationService,
    private readonly postFinishService: NotePostFinishService,
    private readonly rediscoveryService: NoteRediscoveryService,
  ) {}

  async bookOverview({ userId }: { userId: string }): Promise<BookNotesOverviewView> {
    const [memoryNote, postFinish] = await Promise.all([
      this.rediscoveryService.selectBooksMemoryNote({ userId }),
      this.postFinishService.selectPostFinish({ userId }),
    ]);

    return { memoryNote, postFinish };
  }

  async seriesOverview({
    selectedSeriesIds,
    userId,
  }: {
    selectedSeriesIds: readonly string[];
    userId: string;
  }): Promise<SeriesNotesOverviewView> {
    const { beforeNextBook, seriesId } =
      await this.beforeContinuationService.resolveOverviewContext({ selectedSeriesIds, userId });
    if (seriesId === null) {
      return { beforeNextBook, memoryNote: null };
    }

    const memoryNote = await this.rediscoveryService.selectSeriesMemoryNote({ seriesId, userId });
    return { beforeNextBook, memoryNote };
  }
}
