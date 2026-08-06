import { describe, expect, it, vi } from "vitest";

import type { MediaService } from "../../media/application/media.service.js";

import { BookCoverCleanup } from "./book-cover-cleanup.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const MEDIA_ID = "55555555-5555-4555-8555-555555555501";

function buildCleanup(): {
  cleanup: BookCoverCleanup;
  mediaService: { deleteIfUnreferenced: ReturnType<typeof vi.fn> };
} {
  const mediaService = {
    deleteIfUnreferenced: vi.fn().mockResolvedValue(undefined),
  };
  const cleanup = new BookCoverCleanup(mediaService as unknown as MediaService);
  return { cleanup, mediaService };
}

describe("BookCoverCleanup.deleteIfOrphaned", () => {
  it("hands the media to the reference-aware delete", async () => {
    const { cleanup, mediaService } = buildCleanup();

    await cleanup.deleteIfOrphaned({ mediaId: MEDIA_ID, userId: USER_ID });

    expect(mediaService.deleteIfUnreferenced).toHaveBeenCalledWith({
      id: MEDIA_ID,
      userId: USER_ID,
    });
  });

  it("swallows a delete failure without throwing", async () => {
    const { cleanup, mediaService } = buildCleanup();
    mediaService.deleteIfUnreferenced.mockRejectedValue(new Error("storage down"));

    await expect(
      cleanup.deleteIfOrphaned({ mediaId: MEDIA_ID, userId: USER_ID }),
    ).resolves.toBeUndefined();
  });
});
