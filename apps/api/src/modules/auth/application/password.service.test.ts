import { describe, expect, it } from "vitest";

import { PasswordService } from "./password.service.js";

describe("PasswordService", () => {
  const service = new PasswordService();

  it("verifies a password against its own hash", async () => {
    const plain = "supersecret";

    const hash = await service.hash(plain);

    await expect(service.compare(plain, hash)).resolves.toBe(true);
  });

  it("rejects a different password", async () => {
    const hash = await service.hash("supersecret");

    await expect(service.compare("wrongpassword", hash)).resolves.toBe(false);
  });

  it("distinguishes passwords that share their first 72 bytes", async () => {
    const prefix = "a".repeat(72);
    const first = `${prefix}first`;
    const second = `${prefix}second`;

    const hash = await service.hash(first);

    await expect(service.compare(second, hash)).resolves.toBe(false);
  });

  it("always resolves false from fakeCompare regardless of input", async () => {
    await expect(service.fakeCompare("anything")).resolves.toBe(false);
  });
});
