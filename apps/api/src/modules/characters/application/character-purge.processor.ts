import type { Job } from "bullmq";

import { Processor, WorkerHost } from "@nestjs/bullmq";

import { CHARACTER_PURGE_QUEUE_NAME, CharacterPurgeJobSchema } from "../domain/character-purge.js";
import { CharactersService } from "./characters.service.js";

@Processor(CHARACTER_PURGE_QUEUE_NAME)
export class CharacterPurgeProcessor extends WorkerHost {
  constructor(private readonly charactersService: CharactersService) {
    super();
  }

  async process(job: Job<unknown>): Promise<void> {
    const command = CharacterPurgeJobSchema.parse(job.data);
    await this.charactersService.purge(command);
  }
}
