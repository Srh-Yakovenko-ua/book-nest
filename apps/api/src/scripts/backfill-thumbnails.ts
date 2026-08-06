import "reflect-metadata";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "../app.module.js";
import { scanByKeyset } from "../core/keyset-scan.js";
import { createLogger } from "../core/logger.js";
import { MediaService } from "../modules/media/application/media.service.js";
import { MediaRepository } from "../modules/media/infrastructure/media.repository.js";

const log = createLogger("backfill-thumbnails");

const BATCH_SIZE = 200;
const MAX_PAGES = 1_000;

async function backfillThumbnails(): Promise<number> {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const mediaService = app.get(MediaService);
    const mediaRepository = app.get(MediaRepository);

    let ok = 0;
    let failed = 0;

    const summary = await scanByKeyset({
      loadPage: (afterId) => mediaRepository.findIdsWithoutThumbnail({ afterId, take: BATCH_SIZE }),
      maxPages: MAX_PAGES,
      pageSize: BATCH_SIZE,
      scope: "backfill-thumbnails",
      toCursor: (asset) => asset.id,
      visitPage: async (assets) => {
        for (const { id, userId } of assets) {
          try {
            await mediaService.generateThumbnail({ assetId: id, userId });
            ok += 1;
          } catch (error) {
            log.error({ assetId: id, err: error }, "thumbnail backfill failed for asset");
            failed += 1;
          }
        }
        log.info({ failed, ok }, "thumbnail backfill batch done");
      },
    });

    log.info({ failed, ok, visited: summary.visited }, "thumbnail backfill complete");
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
