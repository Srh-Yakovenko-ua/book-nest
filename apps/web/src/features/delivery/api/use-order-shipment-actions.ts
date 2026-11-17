import type {
  ActiveShipmentStatus,
  CancelShipmentInput,
  CreateShipmentInput,
  ReceiveShipmentsResultView,
  UpdateBookOrderInput,
  UpdateShipmentInput,
} from "@app/shared";

import {
  ActiveShipmentStatusSchema,
  BookOrderViewSchema,
  ReceiveShipmentsResultViewSchema,
} from "@app/shared";
import { useMutation, useMutationState } from "@tanstack/react-query";
import { z } from "zod";

import { bookOrdersControllerUpdate } from "@/shared/api/generated/endpoints/book-orders/book-orders";
import {
  shipmentsControllerCancelShipment,
  shipmentsControllerCreateShipment,
  shipmentsControllerMarkInTransit,
  shipmentsControllerMarkReadyForPickup,
  shipmentsControllerMarkReceived,
  shipmentsControllerReceiveShipments,
  shipmentsControllerUpdateShipment,
} from "@/shared/api/generated/endpoints/shipments/shipments";

import { useDeliverySync, useDeliverySyncAwaitingInTransitList } from "./delivery-cache";

const STATUS_REQUESTS: Record<ActiveShipmentStatus, (shipmentId: string) => Promise<unknown>> = {
  in_transit: (shipmentId) => shipmentsControllerMarkInTransit(shipmentId),
  ordered: (shipmentId) => shipmentsControllerUpdateShipment(shipmentId, { status: "ordered" }),
  ready_for_pickup: (shipmentId) => shipmentsControllerMarkReadyForPickup(shipmentId),
};

const SET_SHIPMENT_STATUS = {
  mutationKey: ["shipments", "set-status"],
  variablesSchema: z.object({ shipmentId: z.string(), status: ActiveShipmentStatusSchema }),
} as const;

type SetShipmentStatusVariables = z.infer<typeof SET_SHIPMENT_STATUS.variablesSchema>;

export function useCancelShipment(shipmentId: string) {
  const sync = useDeliverySync();
  return useMutation({
    mutationFn: async (payload: CancelShipmentInput) =>
      BookOrderViewSchema.parseAsync(await shipmentsControllerCancelShipment(shipmentId, payload)),
    onSuccess: sync,
  });
}

export function useCreateShipment(orderId: string) {
  const sync = useDeliverySync();
  return useMutation({
    mutationFn: async (payload: CreateShipmentInput) =>
      BookOrderViewSchema.parseAsync(await shipmentsControllerCreateShipment(orderId, payload)),
    onSuccess: sync,
  });
}

export function usePendingShipmentStatusIds(): string[] {
  const pendingIds = useMutationState({
    filters: { mutationKey: SET_SHIPMENT_STATUS.mutationKey, status: "pending" },
    select: (mutation) =>
      SET_SHIPMENT_STATUS.variablesSchema.safeParse(mutation.state.variables).data?.shipmentId,
  });
  return pendingIds.filter((id) => id !== undefined);
}

export function useReceiveShipment() {
  const sync = useDeliverySync();
  return useMutation({
    mutationFn: async (shipmentId: string) =>
      BookOrderViewSchema.parseAsync(await shipmentsControllerMarkReceived(shipmentId)),
    onSuccess: sync,
  });
}

export function useReceiveShipments() {
  const sync = useDeliverySync();
  return useMutation({
    mutationFn: async (shipmentIds: string[]): Promise<ReceiveShipmentsResultView> =>
      ReceiveShipmentsResultViewSchema.parse(
        await shipmentsControllerReceiveShipments({ shipmentIds }),
      ),
    onSuccess: sync,
  });
}

export function useSetShipmentStatus() {
  const sync = useDeliverySyncAwaitingInTransitList();
  return useMutation({
    mutationFn: async ({ shipmentId, status }: SetShipmentStatusVariables) =>
      BookOrderViewSchema.parseAsync(await STATUS_REQUESTS[status](shipmentId)),
    mutationKey: SET_SHIPMENT_STATUS.mutationKey,
    onSuccess: sync,
  });
}

export function useUpdateOrder(orderId: string) {
  const sync = useDeliverySync();
  return useMutation({
    mutationFn: async (payload: UpdateBookOrderInput) =>
      BookOrderViewSchema.parseAsync(await bookOrdersControllerUpdate(orderId, payload)),
    onSuccess: sync,
  });
}

export function useUpdateShipment(shipmentId: string) {
  const sync = useDeliverySync();
  return useMutation({
    mutationFn: async (payload: UpdateShipmentInput) =>
      BookOrderViewSchema.parseAsync(await shipmentsControllerUpdateShipment(shipmentId, payload)),
    onSuccess: sync,
  });
}
