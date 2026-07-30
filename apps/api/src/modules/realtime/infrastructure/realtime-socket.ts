import type { RealtimeEvent } from "@app/shared";
import type { DefaultEventsMap, Server, Socket } from "socket.io";

import { REALTIME_CONTRACT } from "@app/shared";

export type RealtimeServer = Server<
  DefaultEventsMap,
  RealtimeServerToClientEvents,
  DefaultEventsMap,
  RealtimeSocketData
>;

export type RealtimeSocket = Socket<
  DefaultEventsMap,
  RealtimeServerToClientEvents,
  DefaultEventsMap,
  RealtimeSocketData
>;

type RealtimeServerToClientEvents = {
  [REALTIME_CONTRACT.channel]: (event: RealtimeEvent) => void;
};

type RealtimeSocketData = {
  accessTokenExpiresAt: Date;
  userId: string;
};
