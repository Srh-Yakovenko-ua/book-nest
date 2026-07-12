import "reflect-metadata";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "../app.module.js";
import { createLogger } from "../core/logger.js";
import { MediaService } from "../modules/media/application/media.service.js";
import { MediaRepository } from "../modules/media/infrastructure/media.repository.js";

const log = createLogger("backfill-thumbnails");

async function backfillThumbnails(): Promise<number> {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const mediaService = app.get(MediaService);
    const mediaRepository = app.get(MediaRepository);

    const assets = await mediaRepository.findIdsWithoutThumbnail();
    log.info({ total: assets.length }, "starting thumbnail backfill");

    let ok = 0;
    let failed = 0;

    for (const { id, userId } of assets) {
      try {
        await mediaService.generateThumbnail({ assetId: id, userId });
        ok += 1;
      } catch (error) {
        log.error({ assetId: id, err: error }, "thumbnail backfill failed for asset");
        failed += 1;
      }
    }

    log.info({ failed, ok, total: assets.length }, "thumbnail backfill complete");
    return failed;
  } finally {
    await app.close();
  }
}

backfillThumbnails()
  .then((failed) => {
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch((error: unknown) => {
    log.error({ err: error }, "thumbnail backfill crashed");
    process.exit(1);
  });
