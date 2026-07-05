import { Injectable } from "@nestjs/common";

import { createLogger } from "../../../core/logger.js";
import { MediaService } from "../../media/index.js";
import { BooksRepository } from "../infrastructure/books.repository.js";

const log = createLogger("books.cover-cleanup");

@Injectable()
export class BookCoverCleanup {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly mediaService: MediaService,
  ) {}

  async deleteIfOrphaned({ mediaId, userId }: { mediaId: string; userId: string }): Promise<void> {
    try {
      const referencingBooks = await this.booksRepository.countByCoverMediaId(mediaId);
      if (referencingBooks > 0) {
        return;
      }
      await this.mediaService.delete({ id: mediaId, userId });
    } catch (error) {
      log.warn({ err: error, mediaId }, "failed to delete cover media");
    }
  }
}
