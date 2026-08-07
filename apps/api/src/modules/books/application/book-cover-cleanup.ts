import { Injectable } from "@nestjs/common";

import { createLogger } from "../../../core/logger.js";
import { MediaService } from "../../media/index.js";

const log = createLogger("books.cover-cleanup");

@Injectable()
export class BookCoverCleanup {
  constructor(private readonly mediaService: MediaService) {}

  async deleteIfOrphaned({ mediaId, userId }: { mediaId: string; userId: string }): Promise<void> {
    try {
      await this.mediaService.deleteIfUnreferenced({ id: mediaId, userId });
    } catch (error) {
      log.warn({ err: error, mediaId }, "failed to delete cover media");
    }
  }
}
