import type {
  CancelShipmentInput,
  CreateShipmentInput,
  UpdateBookOrderInput,
  UpdateShipmentInput,
} from "@app/shared";

import { BookOrderViewSchema } from "@app/shared";
import { useMutation } from "@tanstack/react-query";

import { bookOrdersControllerUpdate } from "@/shared/api/generated/endpoints/book-orders/book-orders";
import {
  shipmentsControllerCancelShipment,
  shipmentsControllerCreateShipment,
  shipmentsControllerMarkReceived,
  shipmentsControllerUpdateShipment,
} from "@/shared/api/generated/endpoints/shipments/shipments";

import { useDeliverySync } from "./delivery-cache";

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

export function useReceiveShipment() {
  const sync = useDeliverySync();
  return useMutation({
    mutationFn: async (shipmentId: string) =>
      BookOrderViewSchema.parseAsync(await shipmentsControllerMarkReceived(shipmentId)),
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
