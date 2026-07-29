import type { Nullable } from "@app/shared";
import type { ExecutionContext } from "@nestjs/common";

import { EventEmitter } from "node:events";
import { Socket } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fakeExecutionContext } from "../../../../test/fake.js";
import { MEDIA_ADMISSION, MediaAdmission } from "../../infrastructure/media-admission.js";
import { UploadAdmissionGuard } from "./upload-admission.guard.js";

type FakeResponse = EventEmitter & { socket: Nullable<Socket>; writableEnded: boolean };

type UploadContext = {
  context: ExecutionContext;
  response: FakeResponse;
  socket: Socket;
};

function createUploadContext({
  attachToResponse,
  socket,
}: {
  attachToResponse: boolean;
  socket: Socket;
}): UploadContext {
  const response: FakeResponse = Object.assign(new EventEmitter(), {
    socket: attachToResponse ? socket : null,
    writableEnded: false,
  });
  const context = fakeExecutionContext({ request: { socket }, response });
  return { context, response, socket };
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("UploadAdmissionGuard permit release", () => {
  it("frees every permit held on a pipelined socket when that socket closes", async () => {
    const guard = new UploadAdmissionGuard(new MediaAdmission());
    const sharedSocket = new Socket();
    const head = createUploadContext({ attachToResponse: true, socket: sharedSocket });
    const pipelined = [
      createUploadContext({ attachToResponse: false, socket: sharedSocket }),
      createUploadContext({ attachToResponse: false, socket: sharedSocket }),
    ];

    await guard.canActivate(head.context);
    for (const entry of pipelined) {
      await guard.canActivate(entry.context);
    }

    const admitted = { count: 0 };
    for (let index = 0; index < 3; index += 1) {
      const later = createUploadContext({ attachToResponse: true, socket: new Socket() });
      void guard.canActivate(later.context).then(() => {
        admitted.count += 1;
      });
    }
    await flushMicrotasks();

    expect(admitted.count).toBe(0);

    sharedSocket.destroy();
    await flushMicrotasks();

    expect(admitted.count).toBe(3);
  });

  it("stops listening on the socket once the response completes", async () => {
    vi.useFakeTimers();
    const guard = new UploadAdmissionGuard(new MediaAdmission());
    const socket = new Socket();
    const entry = createUploadContext({ attachToResponse: true, socket });

    await guard.canActivate(entry.context);

    expect(socket.listenerCount("close")).toBe(1);

    entry.response.emit("finish");

    expect(socket.listenerCount("close")).toBe(0);

    await vi.advanceTimersByTimeAsync(MEDIA_ADMISSION.upload.holdDeadlineMs + 1_000);

    expect(socket.destroyed).toBe(false);
  });
});

describe("UploadAdmissionGuard hold deadline", () => {
  it("destroys the socket and frees the permit of a request that never finishes", async () => {
    vi.useFakeTimers();
    const guard = new UploadAdmissionGuard(new MediaAdmission());
    const held = [
      createUploadContext({ attachToResponse: true, socket: new Socket() }),
      createUploadContext({ attachToResponse: true, socket: new Socket() }),
      createUploadContext({ attachToResponse: true, socket: new Socket() }),
    ];
    for (const entry of held) {
      await guard.canActivate(entry.context);
    }

    await vi.advanceTimersByTimeAsync(MEDIA_ADMISSION.upload.holdDeadlineMs);

    expect(held.map((entry) => entry.socket.destroyed)).toEqual([true, true, true]);

    const recovered = createUploadContext({ attachToResponse: true, socket: new Socket() });
    const admitted = { count: 0 };
    void guard.canActivate(recovered.context).then(() => {
      admitted.count += 1;
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(admitted.count).toBe(1);
  });
});
