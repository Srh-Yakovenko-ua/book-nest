import type { MediaView, Nullable } from "@app/shared";
import type { INestApplication } from "@nestjs/common";
import type { Socket } from "socket.io-client";

import { REALTIME_CONTRACT, RealtimeEventSchema } from "@app/shared";
import { HttpStatus } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { request as httpRequest } from "node:http";
import { io } from "socket.io-client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { RealtimeConnectionService } from "../application/realtime-connection.service.js";
import { RealtimePort } from "../domain/realtime.port.js";
import { RealtimeModule } from "../realtime.module.js";

const ALLOWED_ORIGIN = "http://localhost:5173";
const FORBIDDEN_ORIGIN = "https://evil.example";
const CONNECT_TIMEOUT_MS = 5_000;
const WEBSOCKET_KEY_BYTES = 16;
const WEBSOCKET_MASK_BYTES = 4;
const WEBSOCKET_TEXT_FINAL_FRAME = 0x81;
const WEBSOCKET_MASK_FLAG = 0x80;
const WEBSOCKET_CLOSE_OPCODE = 0x88;
const SOCKET_IO_CONNECT_PACKET = "40";
const ENGINE_PONG_PACKET = "3";
const ENGINE_HANDSHAKE_MARKER = '"sid"';
const FLOOD_FRAMES = 5_000;
const MAX_ADMISSIONS_UNDER_FLOOD = 2;
const EXPECTED_ADMISSIONS_AFTER_HEARTBEATS = 1;
const RAW_SETTLE_MS = 250;
const DELIVERY_SETTLE_MS = 150;
const APPLICATION_ERROR_CODES: readonly string[] = Object.values(REALTIME_CONTRACT.errorCodes);

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
          "Sec-WebSocket-Key": randomBytes(WEBSOCKET_KEY_BYTES).toString("base64"),
          "Sec-WebSocket-Version": "13",
          Upgrade: "websocket",
        },
      },
    );
    const timer = setTimeout(() => reject(new Error("raw upgrade timed out")), CONNECT_TIMEOUT_MS);
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
  const mask = randomBytes(WEBSOCKET_MASK_BYTES);
  const masked = Buffer.alloc(body.length);
  for (let index = 0; index < body.length; index += 1) {
    masked[index] = (body[index] ?? 0) ^ (mask[index % WEBSOCKET_MASK_BYTES] ?? 0);
  }
  return Buffer.concat([
    Buffer.from([WEBSOCKET_TEXT_FINAL_FRAME, WEBSOCKET_MASK_FLAG | body.length]),
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
          "Sec-WebSocket-Key": randomBytes(WEBSOCKET_KEY_BYTES).toString("base64"),
          "Sec-WebSocket-Version": "13",
          Upgrade: "websocket",
        },
      },
    );
    const timer = setTimeout(
      () => reject(new Error("raw connection timed out")),
      CONNECT_TIMEOUT_MS,
    );
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
        if (chunk.includes(WEBSOCKET_CLOSE_OPCODE)) {
          settle(true);
          return;
        }
        if (burstWritten || !text.includes(ENGINE_HANDSHAKE_MARKER)) return;
        burstWritten = true;
        socket.write(burst);
        settleTimer = setTimeout(() => settle(false), RAW_SETTLE_MS);
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
  return new Promise((resolve) => setTimeout(resolve, DELIVERY_SETTLE_MS));
}

function waitForConnect(socket: Socket): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("handshake timed out")), CONNECT_TIMEOUT_MS);
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

function waitForRealtimeEvent(socket: Socket): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("event timed out")), CONNECT_TIMEOUT_MS);
    socket.once(REALTIME_CONTRACT.channel, (payload: unknown) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function waitForRejection(socket: Socket): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("rejection timed out")), CONNECT_TIMEOUT_MS);
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
  await app.listen(0);
  const address = app.getHttpServer().address();
  if (address === null || typeof address === "string") {
    throw new Error("test http server is not listening on a tcp port");
  }
  serverUrl = `http://127.0.0.1:${address.port}`;
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

    const socket = connectSocket({ origin: ALLOWED_ORIGIN, token: accessToken });

    await expect(waitForConnect(socket)).resolves.toBeUndefined();
    expect(socket.connected).toBe(true);
  });

  it("accepts a socket authenticated through the Authorization header", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const socket = io(serverUrl, {
      extraHeaders: { Authorization: `Bearer ${accessToken}`, Origin: ALLOWED_ORIGIN },
      path: REALTIME_CONTRACT.path,
      reconnection: false,
      transports: ["websocket"],
    });
    openSockets.push(socket);

    await expect(waitForConnect(socket)).resolves.toBeUndefined();
  });

  it("rejects a socket without a token", async () => {
    const socket = connectSocket({ origin: ALLOWED_ORIGIN });

    await expect(waitForRejection(socket)).resolves.toBe(REALTIME_CONTRACT.errorCodes.unauthorized);
  });

  it("rejects a socket with an invalid token", async () => {
    const socket = connectSocket({ origin: ALLOWED_ORIGIN, token: "not-a-jwt" });

    await expect(waitForRejection(socket)).resolves.toBe(REALTIME_CONTRACT.errorCodes.unauthorized);
  });

  it("rejects a still-valid token whose user was deleted", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await app.get(PrismaService).user.delete({ where: { id: userId } });

    const socket = connectSocket({ origin: ALLOWED_ORIGIN, token: accessToken });

    await expect(waitForRejection(socket)).resolves.toBe(REALTIME_CONTRACT.errorCodes.unauthorized);
  });

  it("refuses a disallowed origin before the websocket upgrade completes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const socket = connectSocket({ origin: FORBIDDEN_ORIGIN, token: accessToken });

    const message = await waitForRejection(socket);
    expect(APPLICATION_ERROR_CODES).not.toContain(message);
  });

  it("aborts the disallowed-origin handshake with the reason in the http response", async () => {
    const refused = await attemptRawUpgrade({ origin: FORBIDDEN_ORIGIN });

    expect(refused.status).toBe(HttpStatus.BAD_REQUEST);
    expect(refused.body).toBe(REALTIME_CONTRACT.errorCodes.forbiddenOrigin);
  });

  it("completes the upgrade for an allowed origin", async () => {
    const accepted = await attemptRawUpgrade({ origin: ALLOWED_ORIGIN });

    expect(accepted.status).toBe(HttpStatus.SWITCHING_PROTOCOLS);
  });

  it("stops a pipelined CONNECT flood at the inbound message budget", async () => {
    const admit = vi.spyOn(app.get(RealtimeConnectionService), "admit");

    const flood = await pipelineRawPackets({
      packets: Array.from({ length: FLOOD_FRAMES }, () => SOCKET_IO_CONNECT_PACKET),
    });

    expect(flood.closedByServer).toBe(true);
    expect(admit.mock.calls.length).toBeLessThanOrEqual(MAX_ADMISSIONS_UNDER_FLOOD);
  });

  it("does not let engine heartbeats consume the inbound budget", async () => {
    const admit = vi.spyOn(app.get(RealtimeConnectionService), "admit");

    const heartbeats = await pipelineRawPackets({
      packets: [
        ...Array.from({ length: FLOOD_FRAMES }, () => ENGINE_PONG_PACKET),
        SOCKET_IO_CONNECT_PACKET,
      ],
    });

    expect(admit).toHaveBeenCalledTimes(EXPECTED_ADMISSIONS_AFTER_HEARTBEATS);
    expect(heartbeats.replies).toContain(REALTIME_CONTRACT.errorCodes.unauthorized);
  });
});

describe("RealtimePort.emitToUser", () => {
  it("delivers a schema-valid event to the owning user only", async () => {
    const owner = await context.registerVerifyAndLogin();
    const other = await context.registerVerifyAndLogin();

    const ownerSocket = connectSocket({ origin: ALLOWED_ORIGIN, token: owner.accessToken });
    const otherSocket = connectSocket({ origin: ALLOWED_ORIGIN, token: other.accessToken });
    await waitForConnect(ownerSocket);
    await waitForConnect(otherSocket);

    let otherReceived = false;
    otherSocket.on(REALTIME_CONTRACT.channel, () => {
      otherReceived = true;
    });

    const received = waitForRealtimeEvent(ownerSocket);
    app.get(RealtimePort).emitToUser({
      event: {
        media: mediaViewFixture(),
        type: REALTIME_CONTRACT.events.mediaThumbnailReady,
      },
      userId: owner.userId,
    });

    const parsed = RealtimeEventSchema.parse(await received);
    expect(parsed.type).toBe(REALTIME_CONTRACT.events.mediaThumbnailReady);
    expect(parsed.media.urls.thumb).toBe("https://cdn.test/media/book_cover/x/thumb.webp");

    await settleDeliveries();
    expect(otherReceived).toBe(false);
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
