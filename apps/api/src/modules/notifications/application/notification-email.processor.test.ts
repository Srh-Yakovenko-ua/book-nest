import type { Job } from "bullmq";

import { describe, expect, it, vi } from "vitest";

import { fakeOf } from "../../../test/fake.js";
import { NotificationEmailDispatcher } from "./notification-email.dispatcher.js";
import { NotificationEmailProcessor } from "./notification-email.processor.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";

function buildProcessor(): {
  dispatchForUser: ReturnType<typeof vi.fn>;
  processor: NotificationEmailProcessor;
} {
  const dispatchForUser = vi.fn().mockResolvedValue(undefined);
  const processor = new NotificationEmailProcessor(
    fakeOf<NotificationEmailDispatcher>({ dispatchForUser }),
  );
  return { dispatchForUser, processor };
}

describe("NotificationEmailProcessor", () => {
  it("parses the job payload and delegates to the dispatcher", async () => {
    const { dispatchForUser, processor } = buildProcessor();

    await processor.process(fakeOf<Job<unknown>>({ data: { userId: USER_ID } }));

    expect(dispatchForUser).toHaveBeenCalledWith({ userId: USER_ID });
  });

  it("rejects a job payload that is not a user id", async () => {
    const { dispatchForUser, processor } = buildProcessor();

    await expect(
      processor.process(fakeOf<Job<unknown>>({ data: { userId: "not-a-uuid" } })),
    ).rejects.toThrow();
    expect(dispatchForUser).not.toHaveBeenCalled();
  });
});
