import { Injectable } from "@nestjs/common";

import type { ReleasePermit } from "../../../core/bounded-semaphore.js";

import { env } from "../../../config/env.js";
import { BoundedSemaphore } from "../../../core/bounded-semaphore.js";

export const MEDIA_ADMISSION = {
  decode: {
    concurrentWorkerCallers: 1,
    name: "media-decode",
    waitTimeoutMs: { http: 15_000, worker: 60_000 },
  },
  upload: {
    holdDeadlineMs: 120_000,
    name: "media-upload",
    waitQueueLimit: 6,
    waitTimeoutMs: 10_000,
  },
} as const;

@Injectable()
export class MediaAdmission {
  private readonly decodePermits = new BoundedSemaphore({
    name: MEDIA_ADMISSION.decode.name,
    permits: env.mediaDecodeConcurrency,
    waitQueueLimit: env.mediaUploadConcurrency + MEDIA_ADMISSION.decode.concurrentWorkerCallers,
  });

  private readonly uploadPermits = new BoundedSemaphore({
    name: MEDIA_ADMISSION.upload.name,
    permits: env.mediaUploadConcurrency,
    waitQueueLimit: MEDIA_ADMISSION.upload.waitQueueLimit,
  });

  acquireUpload(): Promise<ReleasePermit> {
    return this.uploadPermits.acquire({ timeoutMs: MEDIA_ADMISSION.upload.waitTimeoutMs });
  }

  runHttpDecode<T>({ task }: { task: () => Promise<T> }): Promise<T> {
    return this.decodePermits.run({ task, timeoutMs: MEDIA_ADMISSION.decode.waitTimeoutMs.http });
  }

  runWorkerDecode<T>({ task }: { task: () => Promise<T> }): Promise<T> {
    return this.decodePermits.run({ task, timeoutMs: MEDIA_ADMISSION.decode.waitTimeoutMs.worker });
  }
}
