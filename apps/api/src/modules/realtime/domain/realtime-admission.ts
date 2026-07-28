import type { RealtimeErrorCode } from "@app/shared";

export const REALTIME_ADMISSION = {
  maxAuthenticatedConnections: 2000,
  maxConnectionsPerSourceAddress: 32,
  maxConnectionsPerUser: 8,
  maxPendingConnections: 3000,
} as const satisfies Record<string, number>;

export type RealtimeAdmission =
  { code: RealtimeErrorCode; status: "rejected" } | { status: "admitted"; userId: string };
