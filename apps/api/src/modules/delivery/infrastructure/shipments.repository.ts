import type { ActiveShipmentStatus, Nullable } from "@app/shared";

import { SHIPMENT_ACTIVE_STATUSES, ShipmentStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { NewShipmentData } from "./book-orders.repository.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { runInClient } from "../../../core/database/run-in-client.js";
import { Prisma } from "../../../generated/prisma/client.js";

const shipmentRelations = {
  include: { deliveryService: true, order: true },
} satisfies Prisma.ShipmentDefaultArgs;

const LockedShipmentRowsSchema = z.array(z.object({ id: z.uuid() }));

export type ShipmentPatch = {
  deliveryServiceId?: Nullable<string>;
  deliveryServiceName?: Nullable<string>;
  expectedDeliveryDate?: Nullable<Date>;
  note?: Nullable<string>;
  pickupUntil?: Nullable<Date>;
  trackingNumber?: Nullable<string>;
  trackingUrl?: Nullable<string>;
};

export type ShipmentStatusPatch = ShipmentPatch & { status: ActiveShipmentStatus };

export type ShipmentWithRelations = Prisma.ShipmentGetPayload<typeof shipmentRelations>;

type CancelShipmentInput = OwnedShipmentRef & {
  cancelledAt: Date;
  cancelReason: Nullable<string>;
};

type CreateShipmentInput = {
  data: NewShipmentData;
  orderId: string;
  userId: string;
};

type OwnedShipmentRef = {
  shipmentId: string;
  userId: string;
};

type ReceiveShipmentInput = OwnedShipmentRef & {
  receivedAt: Date;
};

@Injectable()
export class ShipmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  cancelActive(
    { cancelledAt, cancelReason, shipmentId, userId }: CancelShipmentInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return this.updateWhileActive({
      client,
      data: { cancelledAt, cancelReason, status: ShipmentStatusSchema.enum.cancelled },
      shipmentId,
      userId,
    });
  }

  create(
    { data, orderId, userId }: CreateShipmentInput,
    client?: Prisma.TransactionClient,
  ): Promise<Nullable<ShipmentWithRelations>> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      const owned = await tx.bookOrder.findFirst({
        select: { id: true },
        where: { id: orderId, userId },
      });
      if (owned === null) {
        return null;
      }

      return tx.shipment.create({ data: { ...data, orderId }, ...shipmentRelations });
    });
  }

  findOwnedById(
    { shipmentId, userId }: OwnedShipmentRef,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<ShipmentWithRelations>> {
    return client.shipment.findFirst({
      where: { id: shipmentId, order: { userId } },
      ...shipmentRelations,
    });
  }

  async lockActive(
    { orderId, shipmentId, userId }: OwnedShipmentRef & { orderId: string },
    client: Prisma.TransactionClient,
  ): Promise<boolean> {
    const rows = await client.$queryRaw(Prisma.sql`
      SELECT shipment.id::text AS "id"
      FROM shipments shipment
      JOIN book_orders book_order ON book_order.id = shipment.order_id
      WHERE shipment.id = ${shipmentId}::uuid
        AND shipment.order_id = ${orderId}::uuid
        AND book_order.user_id = ${userId}::uuid
        AND shipment.status = ANY(${[...SHIPMENT_ACTIVE_STATUSES]}::text[])
      FOR UPDATE OF shipment
    `);

    return LockedShipmentRowsSchema.parse(rows).length === 1;
  }

  receiveActive(
    { receivedAt, shipmentId, userId }: ReceiveShipmentInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return this.updateWhileActive({
      client,
      data: { receivedAt, status: ShipmentStatusSchema.enum.received },
      shipmentId,
      userId,
    });
  }

  updateActive(
    { data, shipmentId, userId }: OwnedShipmentRef & { data: ShipmentPatch },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return this.updateWhileActive({ client, data, shipmentId, userId });
  }

  updateActiveStatus(
    { data, shipmentId, userId }: OwnedShipmentRef & { data: ShipmentStatusPatch },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return this.updateWhileActive({ client, data, shipmentId, userId });
  }

  private async updateWhileActive({
    client,
    data,
    shipmentId,
    userId,
  }: OwnedShipmentRef & {
    client: Prisma.TransactionClient;
    data: Prisma.ShipmentUpdateManyMutationInput;
  }): Promise<number> {
    const updated = await client.shipment.updateMany({
      data,
      where: {
        id: shipmentId,
        order: { userId },
        status: { in: [...SHIPMENT_ACTIVE_STATUSES] },
      },
    });
    return updated.count;
  }
}
