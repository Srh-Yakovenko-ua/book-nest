import type {
  ActiveShipmentStatus,
  BookOrderView,
  CancelShipmentInput,
  CreateShipmentInput,
  MarkShipmentInTransitInput,
  MarkShipmentReadyForPickupInput,
  MoveBookOrderItemsInput,
  Nullable,
  ReceiveShipmentInput,
  ReceiveShipmentsInput,
  ReceiveShipmentsResultView,
  ReceiveShipmentsSkipReason,
  ShipmentStatus,
  UpdateShipmentInput,
} from "@app/shared";

import {
  DELIVERY_ERROR_CODES,
  ReceiveShipmentsSkipReasonSchema,
  ShipmentStatusSchema,
} from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  ShipmentPatch,
  ShipmentWithRelations,
} from "../infrastructure/shipments.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { BadRequestError, NotFoundError } from "../../../core/exceptions/errors.js";
import { toCreateDate, toUpdateDate } from "../../../core/iso-date.js";
import { planShipmentCancellation, planShipmentReceipt } from "../domain/order-item-transition.js";
import {
  evaluateShipmentEdit,
  evaluateShipmentTransition,
  resolveShipmentReceivedAt,
} from "../domain/shipment-transition.js";
import { BookOrderItemsRepository } from "../infrastructure/book-order-items.repository.js";
import { BookOrdersRepository } from "../infrastructure/book-orders.repository.js";
import { OrderBooksRepository } from "../infrastructure/order-books.repository.js";
import { ShipmentsRepository } from "../infrastructure/shipments.repository.js";
import { BookOrderViewLoader } from "./book-order-view.loader.js";
import {
  assertExpectedDeliveryNotBeforeOrder,
  DELIVERY_WRITE_MESSAGES,
  orderNotFoundError,
  shipmentNotActiveError,
  shipmentReceiptSkipError,
} from "./delivery-write-errors.js";
import { ShipmentDeliveryServiceResolver } from "./shipment-delivery-service.resolver.js";

const RECEIVE_SKIP_REASON = ReceiveShipmentsSkipReasonSchema.enum;

const SHIPMENT_STATUS = ShipmentStatusSchema.enum;

type ShipmentReceiptOutcome =
  | { orderId: string; outcome: "received" }
  | { outcome: "skipped"; reason: ReceiveShipmentsSkipReason };

@Injectable()
export class ShipmentService {
  constructor(
    private readonly shipmentsRepository: ShipmentsRepository,
    private readonly bookOrderItemsRepository: BookOrderItemsRepository,
    private readonly bookOrdersRepository: BookOrdersRepository,
    private readonly orderBooksRepository: OrderBooksRepository,
    private readonly deliveryServiceResolver: ShipmentDeliveryServiceResolver,
    private readonly viewLoader: BookOrderViewLoader,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  cancel({
    input,
    shipmentId,
    userId,
  }: {
    input: CancelShipmentInput;
    shipmentId: string;
    userId: string;
  }): Promise<BookOrderView> {
    const now = new Date();

    return this.transactionRunner.run(async (tx) => {
      const shipment = await this.loadShipmentOrThrow({ client: tx, shipmentId, userId });
      const plan = planShipmentCancellation({
        cancelReason: input.cancelReason,
        keepAsWantToBuy: input.keepAsWantToBuy,
        now,
        status: ShipmentStatusSchema.parse(shipment.status),
      });
      if (plan.outcome === "rejected") {
        throw shipmentNotActiveError();
      }

      const cancelled = await this.shipmentsRepository.cancelActive(
        {
          cancelledAt: plan.shipment.cancelledAt,
          cancelReason: plan.shipment.cancelReason,
          shipmentId,
          userId,
        },
        tx,
      );
      if (cancelled === 0) {
        throw shipmentNotActiveError();
      }

      const cancelledItems = await this.bookOrderItemsRepository.cancelActiveForShipment(
        {
          cancelledAt: plan.shipment.cancelledAt,
          cancelReason: plan.shipment.cancelReason,
          shipmentId,
          userId,
        },
        tx,
      );
      await this.orderBooksRepository.applyOwnership(
        {
          bookIds: cancelledItems.map((item) => item.bookId),
          now,
          ownershipStatus: plan.ownership.ownershipStatus,
          userId,
        },
        tx,
      );

      return this.viewLoader.loadOrThrow({ orderId: shipment.orderId, userId }, tx);
    });
  }

  create({
    input,
    orderId,
    userId,
  }: {
    input: CreateShipmentInput;
    orderId: string;
    userId: string;
  }): Promise<BookOrderView> {
    return this.transactionRunner.run(async (tx) => {
      const order = await this.bookOrdersRepository.findOwnedById({ orderId, userId }, tx);
      if (order === null) {
        throw orderNotFoundError();
      }
      assertExpectedDeliveryNotBeforeOrder({
        expectedDeliveryDate: input.expectedDeliveryDate,
        orderDate: order.orderDate,
      });

      const service = await this.deliveryServiceResolver.resolve(
        { name: input.deliveryService, userId },
        tx,
      );
      const shipment = await this.shipmentsRepository.create(
        {
          data: {
            ...service,
            expectedDeliveryDate: toCreateDate(input.expectedDeliveryDate),
            note: input.note ?? null,
            pickupUntil: toCreateDate(input.pickupUntil),
            status: input.status ?? SHIPMENT_STATUS.ordered,
            trackingNumber: input.trackingNumber ?? null,
            trackingUrl: input.trackingUrl ?? null,
          },
          orderId,
          userId,
        },
        tx,
      );
      if (shipment === null) {
        throw orderNotFoundError();
      }

      await this.moveItemsOrThrow({
        client: tx,
        itemIds: input.itemIds,
        orderId,
        shipmentId: shipment.id,
        userId,
      });

      return this.viewLoader.loadOrThrow({ orderId, userId }, tx);
    });
  }

  markInTransit({
    input,
    shipmentId,
    userId,
  }: {
    input: MarkShipmentInTransitInput;
    shipmentId: string;
    userId: string;
  }): Promise<BookOrderView> {
    return this.applyStatusTransition({
      expectedDeliveryDate: input.expectedDeliveryDate,
      patch: {
        ...(input.expectedDeliveryDate === undefined
          ? {}
          : { expectedDeliveryDate: toUpdateDate(input.expectedDeliveryDate) }),
        ...(input.trackingNumber === undefined ? {} : { trackingNumber: input.trackingNumber }),
      },
      shipmentId,
      to: SHIPMENT_STATUS.in_transit,
      userId,
    });
  }

  markReadyForPickup({
    input,
    shipmentId,
    userId,
  }: {
    input: MarkShipmentReadyForPickupInput;
    shipmentId: string;
    userId: string;
  }): Promise<BookOrderView> {
    return this.applyStatusTransition({
      expectedDeliveryDate: undefined,
      patch:
        input.pickupUntil === undefined ? {} : { pickupUntil: toUpdateDate(input.pickupUntil) },
      shipmentId,
      to: SHIPMENT_STATUS.ready_for_pickup,
      userId,
    });
  }

  markReceived({
    input,
    shipmentId,
    userId,
  }: {
    input: ReceiveShipmentInput;
    shipmentId: string;
    userId: string;
  }): Promise<BookOrderView> {
    const now = new Date();

    return this.transactionRunner.run(async (tx) => {
      const receipt = await this.receiveOne({
        client: tx,
        now,
        receivedAt: resolveShipmentReceivedAt({ now, receivedAt: input.receivedAt }),
        shipmentId,
        userId,
      });
      if (receipt.outcome === "skipped") {
        throw shipmentReceiptSkipError(receipt.reason);
      }

      return this.viewLoader.loadOrThrow({ orderId: receipt.orderId, userId }, tx);
    });
  }

  moveItems({
    input,
    orderId,
    userId,
  }: {
    input: MoveBookOrderItemsInput;
    orderId: string;
    userId: string;
  }): Promise<BookOrderView> {
    return this.transactionRunner.run(async (tx) => {
      const order = await this.bookOrdersRepository.findOwnedById({ orderId, userId }, tx);
      if (order === null) {
        throw orderNotFoundError();
      }

      if (input.shipmentId !== null) {
        const locked = await this.shipmentsRepository.lockActive(
          { orderId, shipmentId: input.shipmentId, userId },
          tx,
        );
        if (!locked) {
          throw shipmentNotActiveError();
        }
      }

      await this.moveItemsOrThrow({
        client: tx,
        itemIds: input.itemIds,
        orderId,
        shipmentId: input.shipmentId,
        userId,
      });

      return this.viewLoader.loadOrThrow({ orderId, userId }, tx);
    });
  }

  receiveMany({
    input,
    userId,
  }: {
    input: ReceiveShipmentsInput;
    userId: string;
  }): Promise<ReceiveShipmentsResultView> {
    const now = new Date();
    const requestedShipmentIds = [...new Set(input.shipmentIds)];

    return this.transactionRunner.run(async (tx) => {
      const receivedAt = resolveShipmentReceivedAt({ now, receivedAt: input.receivedAt });
      const receivedShipmentIds: string[] = [];
      const skipped: ReceiveShipmentsResultView["skipped"] = [];

      for (const shipmentId of requestedShipmentIds) {
        const receipt = await this.receiveOne({ client: tx, now, receivedAt, shipmentId, userId });
        if (receipt.outcome === "skipped") {
          skipped.push({ reason: receipt.reason, shipmentId });
          continue;
        }
        receivedShipmentIds.push(shipmentId);
      }

      return { receivedShipmentIds, skipped };
    });
  }

  update({
    input,
    shipmentId,
    userId,
  }: {
    input: UpdateShipmentInput;
    shipmentId: string;
    userId: string;
  }): Promise<BookOrderView> {
    return this.transactionRunner.run(async (tx) => {
      const shipment = await this.loadShipmentOrThrow({ client: tx, shipmentId, userId });
      const status = ShipmentStatusSchema.parse(shipment.status);
      if (evaluateShipmentEdit(status).outcome === "rejected") {
        throw shipmentNotActiveError();
      }
      assertExpectedDeliveryNotBeforeOrder({
        expectedDeliveryDate: input.expectedDeliveryDate,
        orderDate: shipment.order.orderDate,
      });

      const patch: ShipmentPatch = {
        ...(await this.deliveryServiceResolver.resolvePatch(
          { name: input.deliveryService, userId },
          tx,
        )),
        ...(input.expectedDeliveryDate === undefined
          ? {}
          : { expectedDeliveryDate: toUpdateDate(input.expectedDeliveryDate) }),
        ...(input.note === undefined ? {} : { note: input.note }),
        ...(input.pickupUntil === undefined
          ? {}
          : { pickupUntil: toUpdateDate(input.pickupUntil) }),
        ...(input.trackingNumber === undefined ? {} : { trackingNumber: input.trackingNumber }),
        ...(input.trackingUrl === undefined ? {} : { trackingUrl: input.trackingUrl }),
      };

      const updated = await this.updateWhileActive({
        client: tx,
        patch,
        shipmentId,
        status,
        to: input.status,
        userId,
      });
      if (updated === 0) {
        throw shipmentNotActiveError();
      }

      return this.viewLoader.loadOrThrow({ orderId: shipment.orderId, userId }, tx);
    });
  }

  private applyStatusTransition({
    expectedDeliveryDate,
    patch,
    shipmentId,
    to,
    userId,
  }: {
    expectedDeliveryDate: Nullable<string> | undefined;
    patch: ShipmentPatch;
    shipmentId: string;
    to: ActiveShipmentStatus;
    userId: string;
  }): Promise<BookOrderView> {
    return this.transactionRunner.run(async (tx) => {
      const shipment = await this.loadShipmentOrThrow({ client: tx, shipmentId, userId });
      assertExpectedDeliveryNotBeforeOrder({
        expectedDeliveryDate,
        orderDate: shipment.order.orderDate,
      });
      const transition = evaluateShipmentTransition({
        from: ShipmentStatusSchema.parse(shipment.status),
        to,
      });
      if (transition.outcome === "rejected") {
        throw shipmentNotActiveError();
      }

      const updated = await this.shipmentsRepository.updateActiveStatus(
        { data: { ...patch, status: transition.shipment.status }, shipmentId, userId },
        tx,
      );
      if (updated === 0) {
        throw shipmentNotActiveError();
      }

      return this.viewLoader.loadOrThrow({ orderId: shipment.orderId, userId }, tx);
    });
  }

  private async loadShipmentOrThrow({
    client,
    shipmentId,
    userId,
  }: {
    client: Prisma.TransactionClient;
    shipmentId: string;
    userId: string;
  }): Promise<ShipmentWithRelations> {
    const shipment = await this.shipmentsRepository.findOwnedById({ shipmentId, userId }, client);
    if (shipment === null) {
      throw new NotFoundError(DELIVERY_WRITE_MESSAGES.shipmentNotFound);
    }
    return shipment;
  }

  private async moveItemsOrThrow({
    client,
    itemIds,
    orderId,
    shipmentId,
    userId,
  }: {
    client: Prisma.TransactionClient;
    itemIds: string[];
    orderId: string;
    shipmentId: Nullable<string>;
    userId: string;
  }): Promise<void> {
    const moved = await this.bookOrderItemsRepository.moveToShipment(
      { itemIds, orderId, shipmentId, userId },
      client,
    );
    if (moved !== itemIds.length) {
      throw new BadRequestError(DELIVERY_WRITE_MESSAGES.itemsNotMovable, {
        code: DELIVERY_ERROR_CODES.itemsNotMovable,
      });
    }
  }

  private async receiveOne({
    client,
    now,
    receivedAt,
    shipmentId,
    userId,
  }: {
    client: Prisma.TransactionClient;
    now: Date;
    receivedAt: Date;
    shipmentId: string;
    userId: string;
  }): Promise<ShipmentReceiptOutcome> {
    const shipment = await this.shipmentsRepository.findOwnedById({ shipmentId, userId }, client);
    if (shipment === null) {
      return { outcome: "skipped", reason: RECEIVE_SKIP_REASON.not_found };
    }

    const plan = planShipmentReceipt({
      receivedAt,
      status: ShipmentStatusSchema.parse(shipment.status),
    });
    if (plan.outcome === "rejected") {
      return { outcome: "skipped", reason: RECEIVE_SKIP_REASON.not_active };
    }

    const received = await this.shipmentsRepository.receiveActive(
      { receivedAt: plan.shipment.receivedAt, shipmentId, userId },
      client,
    );
    if (received === 0) {
      return { outcome: "skipped", reason: RECEIVE_SKIP_REASON.not_active };
    }

    const receivedItems = await this.bookOrderItemsRepository.receiveForShipment(
      { receivedAt: plan.shipment.receivedAt, shipmentId, userId },
      client,
    );
    await this.orderBooksRepository.applyOwnership(
      {
        bookIds: receivedItems.map((item) => item.bookId),
        now,
        ownershipStatus: plan.ownership.ownershipStatus,
        userId,
      },
      client,
    );

    return { orderId: shipment.orderId, outcome: "received" };
  }

  private updateWhileActive({
    client,
    patch,
    shipmentId,
    status,
    to,
    userId,
  }: {
    client: Prisma.TransactionClient;
    patch: ShipmentPatch;
    shipmentId: string;
    status: ShipmentStatus;
    to: ActiveShipmentStatus | undefined;
    userId: string;
  }): Promise<number> {
    if (to === undefined) {
      return this.shipmentsRepository.updateActive({ data: patch, shipmentId, userId }, client);
    }

    const transition = evaluateShipmentTransition({ from: status, to });
    if (transition.outcome === "rejected") {
      throw shipmentNotActiveError();
    }

    return this.shipmentsRepository.updateActiveStatus(
      { data: { ...patch, status: transition.shipment.status }, shipmentId, userId },
      client,
    );
  }
}
