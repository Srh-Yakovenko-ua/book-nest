import { z } from "zod";

import type { ValueOf } from "./common.js";

import { MediaViewSchema } from "./media.js";

export const REALTIME_CONTRACT = {
  channel: "realtime",
  errorCodes: {
    connectionLimit: "realtime_connection_limit",
    forbiddenOrigin: "realtime_forbidden_origin",
    unauthorized: "realtime_unauthorized",
  },
  events: {
    mediaThumbnailReady: "media.thumbnail.ready",
  },
  path: "/api/socket.io",
} as const satisfies {
  channel: string;
  errorCodes: Record<string, string>;
  events: Record<string, string>;
  path: string;
};

export type RealtimeErrorCode = ValueOf<typeof REALTIME_CONTRACT.errorCodes>;

export const RealtimeEventSchema = z.discriminatedUnion("type", [
  z.object({
    media: MediaViewSchema,
    type: z.literal(REALTIME_CONTRACT.events.mediaThumbnailReady),
  }),
]);

export type RealtimeEvent = z.infer<typeof RealtimeEventSchema>;
