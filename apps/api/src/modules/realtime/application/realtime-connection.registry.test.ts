import { describe, expect, it } from "vitest";

import { REALTIME_ADMISSION } from "../domain/realtime-admission.js";
import { RealtimeConnectionRegistry } from "./realtime-connection.registry.js";

const SOURCE = "203.0.113.7";
const OTHER_SOURCE = "203.0.113.8";

describe("RealtimeConnectionRegistry", () => {
  it("accepts a connection from a fresh source address", () => {
    const registry = new RealtimeConnectionRegistry();

    expect(registry.tryAcquire(SOURCE)).toBe(true);
  });

  it("refuses a source address that reached the per-address cap", () => {
    const registry = new RealtimeConnectionRegistry();
    for (let index = 0; index < REALTIME_ADMISSION.maxConnectionsPerSourceAddress; index += 1) {
      expect(registry.tryAcquire(SOURCE)).toBe(true);
    }

    expect(registry.tryAcquire(SOURCE)).toBe(false);
  });

  it("keeps a saturated source address from blocking a different one", () => {
    const registry = new RealtimeConnectionRegistry();
    for (let index = 0; index < REALTIME_ADMISSION.maxConnectionsPerSourceAddress; index += 1) {
      registry.tryAcquire(SOURCE);
    }

    expect(registry.tryAcquire(OTHER_SOURCE)).toBe(true);
  });

  it("frees a slot on release", () => {
    const registry = new RealtimeConnectionRegistry();
    for (let index = 0; index < REALTIME_ADMISSION.maxConnectionsPerSourceAddress; index += 1) {
      registry.tryAcquire(SOURCE);
    }
    expect(registry.tryAcquire(SOURCE)).toBe(false);

    registry.release(SOURCE);

    expect(registry.tryAcquire(SOURCE)).toBe(true);
  });

  it("ignores a release for an unknown source address", () => {
    const registry = new RealtimeConnectionRegistry();

    expect(() => registry.release(SOURCE)).not.toThrow();
    expect(registry.tryAcquire(SOURCE)).toBe(true);
  });

  it("does not let repeated releases inflate the available capacity", () => {
    const registry = new RealtimeConnectionRegistry();
    registry.tryAcquire(SOURCE);
    registry.release(SOURCE);
    registry.release(SOURCE);
    registry.release(SOURCE);

    for (let index = 0; index < REALTIME_ADMISSION.maxConnectionsPerSourceAddress; index += 1) {
      expect(registry.tryAcquire(SOURCE)).toBe(true);
    }
    expect(registry.tryAcquire(SOURCE)).toBe(false);
  });

  it("refuses every source address once the pending ceiling is reached", () => {
    const registry = new RealtimeConnectionRegistry();
    const addressesNeeded = Math.ceil(
      REALTIME_ADMISSION.maxPendingConnections / REALTIME_ADMISSION.maxConnectionsPerSourceAddress,
    );

    let accepted = 0;
    for (let address = 0; address < addressesNeeded; address += 1) {
      for (let index = 0; index < REALTIME_ADMISSION.maxConnectionsPerSourceAddress; index += 1) {
        if (registry.tryAcquire(`198.51.100.${address}`)) accepted += 1;
      }
    }

    expect(accepted).toBe(REALTIME_ADMISSION.maxPendingConnections);
    expect(registry.tryAcquire("198.51.100.254")).toBe(false);
  });
});
