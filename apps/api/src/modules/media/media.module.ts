import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { RealtimeModule } from "../realtime/index.js";
import { MediaController } from "./api/media.controller.js";
import { MediaThumbnailProcessor } from "./application/media-thumbnail.processor.js";
import { MediaService } from "./application/media.service.js";
import { ImageProcessorPort } from "./domain/image-processor.port.js";
import { MEDIA_QUEUE_NAME } from "./domain/media-queue.js";
import { StoragePort } from "./domain/storage.port.js";
import { MediaAdmission } from "./infrastructure/media-admission.js";
import { MediaRepository } from "./infrastructure/media.repository.js";
import { S3StorageAdapter } from "./infrastructure/s3-storage.adapter.js";
import { SharpImageProcessor } from "./infrastructure/sharp-image.processor.js";

@Module({
  controllers: [MediaController],
  exports: [MediaService],
  imports: [AuthModule, BullModule.registerQueue({ name: MEDIA_QUEUE_NAME }), RealtimeModule],
  providers: [
    MediaAdmission,
    MediaRepository,
    MediaService,
    MediaThumbnailProcessor,
    { provide: ImageProcessorPort, useFactory: () => new SharpImageProcessor() },
    { provide: StoragePort, useClass: S3StorageAdapter },
  ],
})
export class MediaModule {}
