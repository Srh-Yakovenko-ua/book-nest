import type { ActiveShipmentStatus, ShipmentStatus } from "@app/shared";

import { describe, expect, it } from "vitest";

import {
  evaluateShipmentEdit,
  evaluateShipmentTransition,
  resolveShipmentReceivedAt,
} from "./shipment-transition.js";

type TransitionCase = { from: ShipmentStatus; to: ActiveShipmentStatus };

const NOW = new Date("2026-02-01T10:30:00.000Z");

const ACTIVE_STATUSES: ShipmentStatus[] = ["ordered", "in_transit", "ready_for_pickup"];
const TERMINAL_STATUSES: ShipmentStatus[] = ["received", "cancelled"];

const ALLOWED_TRANSITIONS: TransitionCase[] = [
  { from: "ordered", to: "ordered" },
  { from: "ordered", to: "in_transit" },
  { from: "ordered", to: "ready_for_pickup" },
  { from: "in_transit", to: "ordered" },
  { from: "in_transit", to: "in_transit" },
  { from: "in_transit", to: "ready_for_pickup" },
  { from: "ready_for_pickup", to: "ordered" },
  { from: "ready_for_pickup", to: "in_transit" },
  { from: "ready_for_pickup", to: "ready_for_pickup" },
];

const REJECTED_TRANSITIONS: TransitionCase[] = [
  { from: "received", to: "ordered" },
  { from: "received", to: "in_transit" },
  { from: "received", to: "ready_for_pickup" },
  { from: "cancelled", to: "ordered" },
  { from: "cancelled", to: "in_transit" },
  { from: "cancelled", to: "ready_for_pickup" },
];

describe("evaluateShipmentTransition", () => {
  it.each(ALLOWED_TRANSITIONS)(
    "moves an active $from parcel to $to and asks for that exact status",
    ({ from, to }) => {
      expect(evaluateShipmentTransition({ from, to })).toEqual({
        outcome: "allowed",
        shipment: { status: to },
      });
    },
  );

  it.each(REJECTED_TRANSITIONS)(
    "refuses to move a terminal $from parcel to $to and offers no patch to write",
    ({ from, to }) => {
      expect(evaluateShipmentTransition({ from, to })).toEqual({
        outcome: "rejected",
        reason: "shipment_is_terminal",
      });
    },
  );
});

describe("evaluateShipmentEdit", () => {
  it.each(ACTIVE_STATUSES)("allows a field-only edit on a %s parcel", (status) => {
    expect(evaluateShipmentEdit(status)).toEqual({ outcome: "allowed" });
  });

  it.each(TERMINAL_STATUSES)(
    "refuses a field-only edit on a %s parcel, so a closed parcel cannot be reopened or closed twice",
    (status) => {
      expect(evaluateShipmentEdit(status)).toEqual({
        outcome: "rejected",
        reason: "shipment_is_terminal",
      });
    },
  );
});

describe("resolveShipmentReceivedAt", () => {
  it("stamps the injected now when the receipt date is omitted", () => {
    expect(resolveShipmentReceivedAt({ now: NOW, receivedAt: undefined })).toEqual(NOW);
  });

  it("stamps the injected now when the receipt date is explicitly null", () => {
    expect(resolveShipmentReceivedAt({ now: NOW, receivedAt: null })).toEqual(NOW);
  });

  it("parses a supplied receipt date as UTC midnight instead of using now", () => {
    expect(resolveShipmentReceivedAt({ now: NOW, receivedAt: "2026-01-25" })).toEqual(
      new Date("2026-01-25T00:00:00.000Z"),
    );
  });
});
