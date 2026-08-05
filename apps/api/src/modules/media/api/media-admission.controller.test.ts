import type { INestApplication } from "@nestjs/common";
import type { Server } from "node:http";
import type { Socket } from "node:net";

import { getQueueToken } from "@nestjs/bullmq";
import { createConnection } from "node:net";
import sharp from "sharp";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";
import type { ProcessedImage } from "../domain/image-processor.port.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { MediaService } from "../application/media.service.js";
import { ImageProcessorPort } from "../domain/image-processor.port.js";
import { MEDIA_QUEUE_NAME } from "../domain/media-queue.js";
import { StoragePort } from "../domain/storage.port.js";
import { MediaModule } from "../media.module.js";

type Gate = { open: () => void; opened: Promise<void> };

type TrackedUploads = { responses: Promise<request.Response>[] };

const POLL_INTERVAL_MS = 10;
const POLL_ATTEMPTS = 300;
const PIPELINE_BOUNDARY = "booknestpipelinedupload";

function createGate(): Gate {
  let openGate: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    openGate = resolve;
  });
  return { open: () => openGate(), opened };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    if (predicate()) return;
    await delay(POLL_INTERVAL_MS);
  }
  throw new Error("condition was never reached");
}

const decodes = {
  concurrent: 0,
  peakConcurrent: 0,
  started: 0,
};

const handlerEntries: { fileNames: string[] } = { fileNames: [] };

let gate = createGate();

const imageProcessorStub = {
  generateThumbnail: (): Promise<ProcessedImage> => Promise.resolve(processedImage()),
  processFull: async (): Promise<ProcessedImage> => {
    decodes.started += 1;
    decodes.concurrent += 1;
    decodes.peakConcurrent = Math.max(decodes.peakConcurrent, decodes.concurrent);
    await gate.opened;
    decodes.concurrent -= 1;
    return processedImage();
  },
};

const storageStub = {
  delete: (): Promise<void> => Promise.resolve(),
  publicUrl: (key: string): string => `http://test.local/${key}`,
  put: (): Promise<void> => Promise.resolve(),
};

const queueStub = { add: (): Promise<void> => Promise.resolve() };

function processedImage(): ProcessedImage {
  return { body: Buffer.from("webp"), contentType: "image/webp", height: 90, width: 60 };
}

let context: AuthTestContext;
let app: INestApplication;
let mediaService: MediaService;
let uploadDirectly: MediaService["upload"];
let serverPort: number;
let pngBuffer: Buffer;
let accessToken: string;

function listenOnEphemeralPort(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("http server is not bound to a tcp port"));
        return;
      }
      resolve(address.port);
    });
  });
}

beforeAll(async () => {
  context = await createAuthTestContext(
    [AuthModule, MediaModule],
    [
      { provide: ImageProcessorPort, useValue: imageProcessorStub },
      { provide: StoragePort, useValue: storageStub },
      { provide: getQueueToken(MEDIA_QUEUE_NAME), useValue: queueStub },
    ],
  );
  app = context.app;
  mediaService = app.get(MediaService);
  uploadDirectly = MediaService.prototype.upload.bind(mediaService);
  serverPort = await listenOnEphemeralPort(app.getHttpServer());
  pngBuffer = await sharp({
    create: { background: { b: 80, g: 120, r: 200 }, channels: 3, height: 90, width: 60 },
  })
    .png()
    .toBuffer();
});

beforeEach(async () => {
  context.reset();
  decodes.concurrent = 0;
  decodes.peakConcurrent = 0;
  decodes.started = 0;
  handlerEntries.fileNames = [];
  gate = createGate();
  vi.spyOn(mediaService, "upload").mockImplementation((command) => {
    handlerEntries.fileNames.push(command.file.originalName ?? "unnamed");
    return uploadDirectly(command);
  });
  const user = await context.registerVerifyAndLogin();
  accessToken = user.accessToken;
});

afterEach(async () => {
  gate.open();
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

function admittedUploads(label: string): number {
  return handlerEntries.fileNames.filter((fileName) => fileName.startsWith(label)).length;
}

function buildRawUploadRequest({ boundary, token }: { boundary: string; token: string }): Buffer {
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="pipelined.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    pngBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const headers = [
    "POST /api/media HTTP/1.1",
    `Host: 127.0.0.1:${serverPort}`,
    `Authorization: Bearer ${token}`,
    `Content-Type: multipart/form-data; boundary=${boundary}`,
    `Content-Length: ${body.length}`,
    "Connection: keep-alive",
    "",
    "",
  ].join("\r\n");
  return Buffer.concat([Buffer.from(headers), body]);
}

function countStatus(responses: request.Response[], status: number): number {
  return responses.filter((response) => response.status === status).length;
}

function fireUploads({ count, label }: { count: number; label: string }): TrackedUploads {
  const responses = Array.from({ length: count }, (_unused, index) =>
    request(app.getHttpServer())
      .post("/api/media")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", pngBuffer, { contentType: "image/png", filename: `${label}-${index}.png` })
      .then((response) => response),
  );
  return { responses };
}

function pipelineUploadsOnOneSocket(count: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port: serverPort });
    socket.once("error", reject);
    socket.once("connect", () => {
      socket.off("error", reject);
      socket.on("error", () => undefined);
      const bytes = buildRawUploadRequest({ boundary: PIPELINE_BOUNDARY, token: accessToken });
      socket.write(Buffer.concat(Array.from({ length: count }, () => bytes)));
      resolve(socket);
    });
  });
}

describe("POST /api/media admission bounds", () => {
  it("lets only three uploads reach the handler while decodes are blocked", async () => {
    const burst = fireUploads({ count: 10, label: "burst" });

    await waitFor(() => decodes.started >= 1);
    await waitFor(() => handlerEntries.fileNames.length >= 3);

    expect(handlerEntries.fileNames.length).toBe(3);

    gate.open();
    await Promise.all(burst.responses);
  });

  it("never decodes more than one image at the same time", async () => {
    const burst = fireUploads({ count: 5, label: "burst" });

    await waitFor(() => decodes.started >= 1 && admittedUploads("burst") >= 3);

    expect(decodes.concurrent).toBe(1);

    gate.open();
    const responses = await Promise.all(burst.responses);

    expect(decodes.peakConcurrent).toBe(1);
    expect(countStatus(responses, 201)).toBe(5);
  });

  it("sheds the tenth upload with 503 once three run and six are queued", async () => {
    const burst = fireUploads({ count: 10, label: "burst" });
    const settled: request.Response[] = [];
    for (const response of burst.responses) {
      void response.then((value) => settled.push(value));
    }

    await waitFor(() => settled.length >= 1);

    gate.open();
    const responses = await Promise.all(burst.responses);
    const rejected = responses.find((response) => response.status === 503);

    expect(countStatus(responses, 503)).toBe(1);
    expect(countStatus(responses, 201)).toBe(9);
    expect(rejected?.headers["retry-after"]).toBe("15");
    expect(rejected?.body).toMatchObject({ code: "SERVER_BUSY" });
    expect(rejected?.body.message).toBe("Server is busy, please retry");
  });
});

describe("POST /api/media permit release", () => {
  it("frees every permit held by pipelined uploads when their socket dies", async () => {
    const socket = await pipelineUploadsOnOneSocket(6);
    await waitFor(() => admittedUploads("pipelined") >= 3);

    socket.destroy();
    const recovery = fireUploads({ count: 3, label: "recovery" });
    await waitFor(() => admittedUploads("recovery") >= 3);

    expect(admittedUploads("recovery")).toBe(3);

    gate.open();
    await Promise.all(recovery.responses);
    const [afterRecovery] = await Promise.all(fireUploads({ count: 1, label: "after" }).responses);

    expect(afterRecovery?.status).toBe(201);
  });
});
