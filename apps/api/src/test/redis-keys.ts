import type { Redis } from "ioredis";

import { z } from "zod";

const SCAN_BATCH_SIZE = 500;

const scannedKeysSchema = z.array(z.string());

export async function deleteKeysUnderPrefix({
  client,
  prefix,
}: {
  client: Redis;
  prefix: string;
}): Promise<void> {
  const stream = client.scanStream({ count: SCAN_BATCH_SIZE, match: `${prefix}*` });

  for await (const batch of stream) {
    const prefixedKeys = scannedKeysSchema.parse(batch);
    if (prefixedKeys.length === 0) continue;
    await client.del(prefixedKeys.map((key) => key.slice(prefix.length)));
  }
}
