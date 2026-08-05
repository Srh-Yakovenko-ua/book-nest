export const REALTIME_TRANSPORT = {
  connectTimeoutMs: 5_000,
  maxHttpBufferSizeBytes: 4 * 1024,
  maxInboundMessages: 2,
} as const satisfies Record<string, number>;
