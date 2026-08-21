import type { ActiveShipmentStatus, Nullable, ShipmentStatus, ValueOf } from "@app/shared";

import { isActiveShipmentStatus } from "@app/shared";

import { parseIsoDate } from "../../../core/iso-date.js";

export const SHIPMENT_TRANSITION_REJECTIONS = {
  terminalShipment: "shipment_is_terminal",
} as const;

export type ShipmentCancelPatch = {
  cancelledAt: Date;
  cancelReason: Nullable<string>;
  status: Extract<ShipmentStatus, "cancelled">;
};

export type ShipmentEdit = ShipmentTransitionRejected | { outcome: "allowed" };

export type ShipmentReceivePatch = {
  receivedAt: Date;
  status: Extract<ShipmentStatus, "received">;
};

export type ShipmentStatusPatch = {
  status: ActiveShipmentStatus;
};

export type ShipmentTransition =
  ShipmentTransitionRejected | { outcome: "allowed"; shipment: ShipmentStatusPatch };

export type ShipmentTransitionRejected = {
  outcome: "rejected";
  reason: ShipmentTransitionRejection;
};

export type ShipmentTransitionRejection = ValueOf<typeof SHIPMENT_TRANSITION_REJECTIONS>;

export function evaluateShipmentEdit(status: ShipmentStatus): ShipmentEdit {
  const rejection = rejectTerminalShipment(status);
  return rejection ?? { outcome: "allowed" };
}

export function evaluateShipmentTransition({
  from,
  to,
}: {
  from: ShipmentStatus;
  to: ActiveShipmentStatus;
}): ShipmentTransition {
  const rejection = rejectTerminalShipment(from);
  return rejection ?? { outcome: "allowed", shipment: { status: to } };
}

export function rejectTerminalShipment(
  status: ShipmentStatus,
): Nullable<ShipmentTransitionRejected> {
  if (isActiveShipmentStatus(status)) {
    return null;
  }

  return { outcome: "rejected", reason: SHIPMENT_TRANSITION_REJECTIONS.terminalShipment };
}

export function resolveShipmentReceivedAt({
  now,
  receivedAt,
}: {
  now: Date;
  receivedAt: Nullable<string> | undefined;
}): Date {
  return receivedAt === null || receivedAt === undefined ? now : parseIsoDate(receivedAt);
}
