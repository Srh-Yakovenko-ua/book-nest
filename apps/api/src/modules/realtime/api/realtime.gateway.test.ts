import type { MediaView, Nullable } from "@app/shared";
import type { INestApplication } from "@nestjs/common";
import type { Socket } from "socket.io-client";

import { REALTIME_CONTRACT, RealtimeEventSchema } from "@app/shared";
import { HttpStatus } from "@nestjs/common";
import { addSeconds, getUnixTime } from "date-fns";
import { SignJWT } from "jose";
import { randomBytes } from "node:crypto";
import { request as httpRequest } from "node:http";
import { io } from "socket.io-client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { env } from "../../../config/env.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { testAppPort } from "../../../test/create-test-app.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { RealtimeConnectionRegistry } from "../application/realtime-connection.registry.js";
import { RealtimeConnectionService } from "../application/realtime-connection.service.js";
import { RealtimePort } from "../domain/realtime.port.js";
import { RealtimeModule } from "../realtime.module.js";

const HANDSHAKE_ORIGIN = {
  allowed: "http://localhost:5173",
  forbidden: "https://evil.example",
} as const satisfies Record<string, string>;

const WAIT_MS = {
  connect: 5_000,
  deliverySettle: 150,
  rawSettle: 250,
} as const satisfies Record<string, number>;

const WEBSOCKET_WIRE = {
  closeOpcode: 0x88,
  handshakeKeyBytes: 16,
  maskBytes: 4,
  maskFlag: 0x80,
  textFinalOpcode: 0x81,
} as const satisfies Record<string, number>;

const SOCKET_IO_WIRE = {
  connectPacket: "40",
  enginePongPacket: "3",
  handshakeMarker: '"sid"',
} as const satisfies Record<string, string>;

const CONNECT_FLOOD = {
  expectedAdmissionsAfterHeartbeats: 1,
  frames: 5_000,
  maxAdmissions: 2,
} as const satisfies Record<string, number>;

const EMITTED_UNREAD_COUNT = 3;

const SHORT_LIVED_TOKEN = {
  alg: "HS256",
  ttlSeconds: 2,
} as const satisfies { alg: string; ttlSeconds: number };

let context: AuthTestContext;
let app: INestApplication;
let serverUrl: string;

const openSockets: Socket[] = [];

function attemptRawUpgrade({
  origin,
}: {
  origin: string;
}): Promise<{ body: string; status: number }> {
  return new Promise((resolve, reject) => {
    const upgradeRequest = httpRequest(
      `${serverUrl}${REALTIME_CONTRACT.path}/?EIO=4&transport=websocket`,
      {
        headers: {
          Connection: "Upgrade",
          Origin: origin,
          "Sec-WebSocket-Key": randomBytes(WEBSOCKET_WIRE.handshakeKeyBytes).toString("base64"),
          "Sec-WebSocket-Version": "13",
          Upgrade: "websocket",
        },
      },
    );
    const timer = setTimeout(() => reject(new Error("raw upgrade timed out")), WAIT_MS.connect);
    upgradeRequest.on("response", (response) => {
      clearTimeout(timer);
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => {
        body += chunk;
      });
      response.on("end", () => resolve({ body, status: response.statusCode ?? 0 }));
    });
    upgradeRequest.on("upgrade", (response, socket) => {
      clearTimeout(timer);
      socket.destroy();
      resolve({ body: "", status: response.statusCode ?? 0 });
    });
    upgradeRequest.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    upgradeRequest.end();
  });
}

async function connectOwnerAndBystander(): Promise<{
  hasBystanderReceived: () => boolean;
  ownerSocket: Socket;
  ownerUserId: string;
}> {
  const owner = await context.registerVerifyAndLogin();
  const bystander = await context.registerVerifyAndLogin();

  const ownerSocket = connectSocket({ origin: HANDSHAKE_ORIGIN.allowed, token: owner.accessToken });
  const bystanderSocket = connectSocket({
    origin: HANDSHAKE_ORIGIN.allowed,
    token: bystander.accessToken,
  });
  await waitForConnect(ownerSocket);
  await waitForConnect(bystanderSocket);

  let bystanderReceived = false;
  bystanderSocket.on(REALTIME_CONTRACT.channel, () => {
    bystanderReceived = true;
  });

  return {
    hasBystanderReceived: () => bystanderReceived,
    ownerSocket,
    ownerUserId: owner.userId,
  };
}

function connectSocket({ origin, token }: { origin?: string; token?: string }): Socket {
  const socket = io(serverUrl, {
    auth: token === undefined ? {} : { token },
    ...(origin === undefined ? {} : { extraHeaders: { Origin: origin } }),
    path: REALTIME_CONTRACT.path,
    reconnection: false,
    transports: ["websocket"],
  });
  openSockets.push(socket);
  return socket;
}

function maskedTextFrame(body: Buffer): Buffer {
  const mask = randomBytes(WEBSOCKET_WIRE.maskBytes);
  const masked = Buffer.alloc(body.length);
  for (let index = 0; index < body.length; index += 1) {
    masked[index] = (body[index] ?? 0) ^ (mask[index % WEBSOCKET_WIRE.maskBytes] ?? 0);
  }
  return Buffer.concat([
    Buffer.from([WEBSOCKET_WIRE.textFinalOpcode, WEBSOCKET_WIRE.maskFlag | body.length]),
    mask,
    masked,
  ]);
}

function mediaViewFixture(): MediaView {
  return {
    contentType: "image/webp",
    createdAt: "2026-07-28T10:00:00.000Z",
    height: 1200,
    id: "22222222-2222-4222-8222-222222222222",
    kind: "book_cover",
    name: "cover.png",
    sizeBytes: 1234,
    urls: {
      card: "https://cdn.test/media/book_cover/x/image.webp",
      full: "https://cdn.test/media/book_cover/x/image.webp",
      thumb: "https://cdn.test/media/book_cover/x/thumb.webp",
    },
    width: 800,
  };
}

function pipelineRawPackets({
  packets,
}: {
  packets: readonly string[];
}): Promise<{ closedByServer: boolean; replies: string }> {
  const burst = Buffer.concat(packets.map((packet) => maskedTextFrame(Buffer.from(packet))));

  return new Promise((resolve, reject) => {
    const upgradeRequest = httpRequest(
      `${serverUrl}${REALTIME_CONTRACT.path}/?EIO=4&transport=websocket`,
      {
        headers: {
          Connection: "Upgrade",
          "Sec-WebSocket-Key": randomBytes(WEBSOCKET_WIRE.handshakeKeyBytes).toString("base64"),
          "Sec-WebSocket-Version": "13",
          Upgrade: "websocket",
        },
      },
    );
    const timer = setTimeout(() => reject(new Error("raw connection timed out")), WAIT_MS.connect);
    upgradeRequest.on("upgrade", (_response, socket, head: Buffer) => {
      let burstWritten = false;
      let replies = "";
      let settleTimer: Nullable<NodeJS.Timeout> = null;
      const settle = (closedByServer: boolean): void => {
        clearTimeout(timer);
        if (settleTimer !== null) clearTimeout(settleTimer);
        socket.destroy();
        resolve({ closedByServer, replies });
      };
      const readChunk = (chunk: Buffer): void => {
        const text = chunk.toString("latin1");
        replies += text;
        if (chunk.includes(WEBSOCKET_WIRE.closeOpcode)) {
          settle(true);
          return;
        }
        if (burstWritten || !text.includes(SOCKET_IO_WIRE.handshakeMarker)) return;
        burstWritten = true;
        socket.write(burst);
        settleTimer = setTimeout(() => settle(false), WAIT_MS.rawSettle);
      };
      socket.on("data", readChunk);
      socket.on("close", () => settle(true));
      socket.on("error", () => settle(true));
      if (head.length > 0) readChunk(head);
    });
    upgradeRequest.on("response", () => {
      clearTimeout(timer);
      reject(new Error("handshake was refused before the upgrade"));
    });
    upgradeRequest.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    upgradeRequest.end();
  });
}

function settleDeliveries(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, WAIT_MS.deliverySettle));
}

function shortLivedAccessToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: SHORT_LIVED_TOKEN.alg })
    .setIssuedAt()
    .setExpirationTime(getUnixTime(addSeconds(new Date(), SHORT_LIVED_TOKEN.ttlSeconds)))
    .sign(new TextEncoder().encode(env.jwtAccessSecret));
}

function waitForConnect(socket: Socket): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("handshake timed out")), WAIT_MS.connect);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("connect_error", (error: Error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function waitForDisconnect(socket: Socket): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("disconnect timed out")), WAIT_MS.connect);
    socket.once("disconnect", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function waitForRealtimeEvent(socket: Socket): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("event timed out")), WAIT_MS.connect);
    socket.once(REALTIME_CONTRACT.channel, (payload: unknown) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function waitForRejection(socket: Socket): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("rejection timed out")), WAIT_MS.connect);
    socket.once("connect", () => {
      clearTimeout(timer);
      reject(new Error("expected the handshake to be rejected"));
    });
    socket.once("connect_error", (error: Error) => {
      clearTimeout(timer);
      resolve(error.message);
    });
  });
}

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, RealtimeModule]);
  app = context.app;
  serverUrl = `http://127.0.0.1:${testAppPort(app)}`;
});

afterEach(async () => {
  for (const socket of openSockets.splice(0)) {
    socket.disconnect();
  }
  await truncateAllTables(app);
  context.reset();
});

afterAll(async () => {
  await context.close();
});

describe("RealtimeGateway handshake", () => {
  it("accepts a socket carrying a valid access token", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const socket = connectSocket({ origin: HANDSHAKE_ORIGIN.allowed, token: accessToken });

    await expect(waitForConnect(socket)).resolves.toBeUndefined();
    expect(socket.connected).toBe(true);
  });

  it("accepts a socket authenticated through the Authorization header", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const socket = io(serverUrl, {
      extraHeaders: { Authorization: `Bearer ${accessToken}`, Origin: HANDSHAKE_ORIGIN.allowed },
      path: REALTIME_CONTRACT.path,
      reconnection: false,
      transports: ["websocket"],
    });
    openSockets.push(socket);

    await expect(waitForConnect(socket)).resolves.toBeUndefined();
  });

  it("rejects a socket without a token", async () => {
    const socket = connectSocket({ origin: HANDSHAKE_ORIGIN.allowed });

    await expect(waitForRejection(socket)).resolves.toBe(REALTIME_CONTRACT.errorCodes.unauthorized);
  });

  it("rejects a socket with an invalid token", async () => {
    const socket = connectSocket({ origin: HANDSHAKE_ORIGIN.allowed, token: "not-a-jwt" });

    await expect(waitForRejection(socket)).resolves.toBe(REALTIME_CONTRACT.errorCodes.unauthorized);
  });

  it("rejects a still-valid token whose user was deleted", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await app.get(PrismaService).user.delete({ where: { id: userId } });

    const socket = connectSocket({ origin: HANDSHAKE_ORIGIN.allowed, token: accessToken });

    await expect(waitForRejection(socket)).resolves.toBe(REALTIME_CONTRACT.errorCodes.unauthorized);
  });

  it("aborts a disallowed-origin upgrade before it reserves a connection slot", async () => {
    const tryAcquire = vi.spyOn(app.get(RealtimeConnectionRegistry), "tryAcquire");

    const refused = await attemptRawUpgrade({ origin: HANDSHAKE_ORIGIN.forbidden });

    expect(refused.status).toBe(HttpStatus.BAD_REQUEST);
    expect(refused.body).toContain(REALTIME_CONTRACT.errorCodes.forbiddenOrigin);
    expect(tryAcquire).not.toHaveBeenCalled();
  });

  it("refuses a disallowed origin before it authenticates the token", async () => {
    const admit = vi.spyOn(app.get(RealtimeConnectionService), "admit");
    const { accessToken } = await context.registerVerifyAndLogin();

    const socket = connectSocket({ origin: HANDSHAKE_ORIGIN.forbidden, token: accessToken });
    await waitForRejection(socket);

    expect(admit).not.toHaveBeenCalled();
  });

  it("completes the upgrade for an allowed origin", async () => {
    const accepted = await attemptRawUpgrade({ origin: HANDSHAKE_ORIGIN.allowed });

    expect(accepted.status).toBe(HttpStatus.SWITCHING_PROTOCOLS);
  });

  it("closes an admitted socket the moment its access token expires", async () => {
    const { userId } = await context.registerVerifyAndLogin();
    const socket = connectSocket({
      origin: HANDSHAKE_ORIGIN.allowed,
      token: await shortLivedAccessToken(userId),
    });
    await waitForConnect(socket);

    await expect(waitForDisconnect(socket)).resolves.toBeUndefined();
    expect(socket.connected).toBe(false);
  });

  it("stops a pipelined CONNECT flood at the inbound message budget", async () => {
    const admit = vi.spyOn(app.get(RealtimeConnectionService), "admit");

    const flood = await pipelineRawPackets({
      packets: Array.from({ length: CONNECT_FLOOD.frames }, () => SOCKET_IO_WIRE.connectPacket),
    });

    expect(flood.closedByServer).toBe(true);
    expect(admit.mock.calls.length).toBeLessThanOrEqual(CONNECT_FLOOD.maxAdmissions);
  });

  it("does not let engine heartbeats consume the inbound budget", async () => {
    const admit = vi.spyOn(app.get(RealtimeConnectionService), "admit");

    const heartbeats = await pipelineRawPackets({
      packets: [
        ...Array.from({ length: CONNECT_FLOOD.frames }, () => SOCKET_IO_WIRE.enginePongPacket),
        SOCKET_IO_WIRE.connectPacket,
      ],
    });

    expect(admit).toHaveBeenCalledTimes(CONNECT_FLOOD.expectedAdmissionsAfterHeartbeats);
    expect(heartbeats.replies).toContain(REALTIME_CONTRACT.errorCodes.unauthorized);
  });
});

describe("RealtimePort.emitToUser", () => {
  it("delivers a schema-valid event to the owning user only", async () => {
    const { hasBystanderReceived, ownerSocket, ownerUserId } = await connectOwnerAndBystander();

    const received = waitForRealtimeEvent(ownerSocket);
    app.get(RealtimePort).emitToUser({
      event: {
        media: mediaViewFixture(),
        type: REALTIME_CONTRACT.events.mediaThumbnailReady,
      },
      userId: ownerUserId,
    });

    expect(RealtimeEventSchema.parse(await received)).toEqual({
      media: mediaViewFixture(),
      type: REALTIME_CONTRACT.events.mediaThumbnailReady,
    });

    await settleDeliveries();
    expect(hasBystanderReceived()).toBe(false);
  });

  it("delivers the recomputed unread count to the owning user only", async () => {
    const { hasBystanderReceived, ownerSocket, ownerUserId } = await connectOwnerAndBystander();

    const received = waitForRealtimeEvent(ownerSocket);
    app.get(RealtimePort).emitToUser({
      event: {
        type: REALTIME_CONTRACT.events.notificationsChanged,
        unreadCount: EMITTED_UNREAD_COUNT,
      },
      userId: ownerUserId,
    });

    expect(RealtimeEventSchema.parse(await received)).toEqual({
      type: REALTIME_CONTRACT.events.notificationsChanged,
      unreadCount: EMITTED_UNREAD_COUNT,
    });

    await settleDeliveries();
    expect(hasBystanderReceived()).toBe(false);
  });

  it("silently drops an event addressed to a user without a live socket", async () => {
    const { userId } = await context.registerVerifyAndLogin();

    expect(() =>
      app.get(RealtimePort).emitToUser({
        event: {
          media: mediaViewFixture(),
          type: REALTIME_CONTRACT.events.mediaThumbnailReady,
        },
        userId,
      }),
    ).not.toThrow();
  });
});
