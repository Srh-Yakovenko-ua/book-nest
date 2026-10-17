const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MIN_BYTES_PER_JSON_VALUE = 16;

export const CHARACTER_IMPORT_TRANSPORT = {
  admission: {
    name: "character-import",
    permits: 1,
    waitQueueLimit: 2,
    waitTimeoutMs: 15_000,
  },
  body: {
    maxBytes: MAX_BODY_BYTES,
    maxJsonObjectMembers: 64,
    maxJsonValues: MAX_BODY_BYTES / MIN_BYTES_PER_JSON_VALUE,
    minBytesPerJsonValue: MIN_BYTES_PER_JSON_VALUE,
    readDeadlineMs: 30_000,
  },
  route: {
    method: "POST",
    path: "/api/characters/import",
  },
} as const;
