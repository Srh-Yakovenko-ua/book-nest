import type { Job } from "bullmq";

import { Processor, WorkerHost } from "@nestjs/bullmq";

import { GenerateThumbJobSchema, MEDIA_QUEUE_NAME } from "../domain/media-queue.js";
import { MediaService } from "./media.service.js";

@Processor(MEDIA_QUEUE_NAME)
export class MediaThumbnailProcessor extends WorkerHost {
  constructor(private readonly mediaService: MediaService) {
    super();
  }

  async process(job: Job<unknown>): Promise<void> {
    const command = GenerateThumbJobSchema.parse(job.data);
    await this.mediaService.generateThumbnail(command);
  }
}
