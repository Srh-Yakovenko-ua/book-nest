import type { Job } from "bullmq";

import { describe, expect, it, vi } from "vitest";

import type { CharactersService } from "./characters.service.js";

import { CharacterPurgeProcessor } from "./character-purge.processor.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CHARACTER_ID = "22222222-2222-4222-8222-222222222222";

function buildProcessor(): {
  charactersService: { purge: ReturnType<typeof vi.fn> };
  processor: CharacterPurgeProcessor;
} {
  const charactersService = { purge: vi.fn().mockResolvedValue(undefined) };
  const processor = new CharacterPurgeProcessor(charactersService as unknown as CharactersService);
  return { charactersService, processor };
}

function purgeJob(data: unknown): Job<unknown> {
  return { data } as unknown as Job<unknown>;
}

describe("CharacterPurgeProcessor.process", () => {
  it("parses the job payload and delegates to the characters service once", async () => {
    const { charactersService, processor } = buildProcessor();

    await processor.process(purgeJob({ characterId: CHARACTER_ID, userId: USER_ID }));

    expect(charactersService.purge).toHaveBeenCalledTimes(1);
    expect(charactersService.purge).toHaveBeenCalledWith({
      characterId: CHARACTER_ID,
      userId: USER_ID,
    });
  });

  it("rejects a payload that is not a valid purge job and does not delegate", async () => {
    const { charactersService, processor } = buildProcessor();

    await expect(processor.process(purgeJob({ characterId: "not-a-uuid" }))).rejects.toThrow();

    expect(charactersService.purge).not.toHaveBeenCalled();
  });
});
