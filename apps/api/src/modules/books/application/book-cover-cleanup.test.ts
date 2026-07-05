import { describe, expect, it, vi } from "vitest";

import type { MediaService } from "../../media/application/media.service.js";
import type { BooksRepository } from "../infrastructure/books.repository.js";

import { BookCoverCleanup } from "./book-cover-cleanup.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const MEDIA_ID = "55555555-5555-4555-8555-555555555501";

function buildCleanup(overrides: { countByCoverMediaId?: number } = {}): {
  booksRepository: { countByCoverMediaId: ReturnType<typeof vi.fn> };
  cleanup: BookCoverCleanup;
  mediaService: { delete: ReturnType<typeof vi.fn> };
} {
  const booksRepository = {
    countByCoverMediaId: vi.fn().mockResolvedValue(overrides.countByCoverMediaId ?? 0),
  };
  const mediaService = {
    delete: vi.fn().mockResolvedValue(undefined),
  };
  const cleanup = new BookCoverCleanup(
    booksRepository as unknown as BooksRepository,
    mediaService as unknown as MediaService,
  );
  return { booksRepository, cleanup, mediaService };
}

describe("BookCoverCleanup.deleteIfOrphaned", () => {
  it("deletes the media when no other book references it", async () => {
    const { cleanup, mediaService } = buildCleanup({ countByCoverMediaId: 0 });

    await cleanup.deleteIfOrphaned({ mediaId: MEDIA_ID, userId: USER_ID });

    expect(mediaService.delete).toHaveBeenCalledWith({ id: MEDIA_ID, userId: USER_ID });
  });

  it("keeps the media when another book still references it", async () => {
    const { cleanup, mediaService } = buildCleanup({ countByCoverMediaId: 1 });

    await cleanup.deleteIfOrphaned({ mediaId: MEDIA_ID, userId: USER_ID });

    expect(mediaService.delete).not.toHaveBeenCalled();
  });

  it("swallows a delete failure without throwing", async () => {
    const { cleanup, mediaService } = buildCleanup({ countByCoverMediaId: 0 });
    mediaService.delete.mockRejectedValue(new Error("storage down"));

    await expect(
      cleanup.deleteIfOrphaned({ mediaId: MEDIA_ID, userId: USER_ID }),
    ).resolves.toBeUndefined();
  });
});
