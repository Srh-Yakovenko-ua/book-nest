import type { Job } from "bullmq";

import { describe, expect, it, vi } from "vitest";

import type { MediaService } from "./media.service.js";

import { MediaThumbnailProcessor } from "./media-thumbnail.processor.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ASSET_ID = "22222222-2222-4222-8222-222222222222";

function buildProcessor(): {
  mediaService: { generateThumbnail: ReturnType<typeof vi.fn> };
  processor: MediaThumbnailProcessor;
} {
  const mediaService = { generateThumbnail: vi.fn().mockResolvedValue(undefined) };
  const processor = new MediaThumbnailProcessor(mediaService as unknown as MediaService);
  return { mediaService, processor };
}

function thumbJob(data: unknown): Job<unknown> {
  return { data } as unknown as Job<unknown>;
}

describe("MediaThumbnailProcessor.process", () => {
  it("parses the job payload and delegates to the media service once", async () => {
    const { mediaService, processor } = buildProcessor();

    await processor.process(thumbJob({ assetId: ASSET_ID, userId: USER_ID }));

    expect(mediaService.generateThumbnail).toHaveBeenCalledTimes(1);
    expect(mediaService.generateThumbnail).toHaveBeenCalledWith({
      assetId: ASSET_ID,
      userId: USER_ID,
    });
  });

  it("rejects a job payload that is not a valid generate-thumb job and does not delegate", async () => {
    const { mediaService, processor } = buildProcessor();

    await expect(processor.process(thumbJob({ assetId: "not-a-uuid" }))).rejects.toThrow();

    expect(mediaService.generateThumbnail).not.toHaveBeenCalled();
  });
});
