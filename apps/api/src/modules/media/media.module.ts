import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { MediaController } from "./api/media.controller.js";
import { MediaService } from "./application/media.service.js";
import { ImageProcessorPort } from "./domain/image-processor.port.js";
import { StoragePort } from "./domain/storage.port.js";
import { MediaRepository } from "./infrastructure/media.repository.js";
import { S3StorageAdapter } from "./infrastructure/s3-storage.adapter.js";
import { SharpImageProcessor } from "./infrastructure/sharp-image.processor.js";

@Module({
  controllers: [MediaController],
  exports: [MediaService],
  imports: [AuthModule],
  providers: [
    MediaRepository,
    MediaService,
    { provide: ImageProcessorPort, useFactory: () => new SharpImageProcessor() },
    { provide: StoragePort, useClass: S3StorageAdapter },
  ],
})
export class MediaModule {}
