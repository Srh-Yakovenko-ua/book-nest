import type {
  BookView,
  CancelDeliveryInput,
  CreateDeliveryInput,
  DeliveryView,
  UpdateDeliveryInput,
} from "@app/shared";

import { BookViewSchema, DeliveryViewSchema } from "@app/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";

import {
  bookDeliveryControllerCancel,
  bookDeliveryControllerCreate,
  bookDeliveryControllerListHistory,
  bookDeliveryControllerReceive,
  bookDeliveryControllerUpdate,
} from "@/shared/api/generated/endpoints/books/books";

import { bookKeys } from "./book-keys";
import { useBookMutationSync } from "./use-book-mutation-sync";

export function useCancelDelivery() {
  const sync = useBookMutationSync();

  return useMutation({
    mutationFn: async (input: {
      deliveryId: string;
      id: string;
      payload: CancelDeliveryInput;
    }): Promise<BookView> =>
      BookViewSchema.parse(
        await bookDeliveryControllerCancel(input.id, input.deliveryId, input.payload),
      ),
    onSuccess: sync,
  });
}

export function useCreateDelivery() {
  const sync = useBookMutationSync();

  return useMutation({
    mutationFn: async (input: { id: string; payload: CreateDeliveryInput }): Promise<BookView> =>
      BookViewSchema.parse(await bookDeliveryControllerCreate(input.id, input.payload)),
    onSuccess: sync,
  });
}

export function useDeliveryHistory(id: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: async (): Promise<DeliveryView[]> =>
      z.array(DeliveryViewSchema).parse(await bookDeliveryControllerListHistory(id)),
    queryKey: bookKeys.deliveryHistory(id),
    retry: false,
  });
}

export function useReceiveDelivery() {
  const sync = useBookMutationSync();

  return useMutation({
    mutationFn: async (input: { deliveryId: string; id: string }): Promise<BookView> =>
      BookViewSchema.parse(await bookDeliveryControllerReceive(input.id, input.deliveryId)),
    onSuccess: sync,
  });
}

export function useUpdateDelivery() {
  const sync = useBookMutationSync();

  return useMutation({
    mutationFn: async (input: {
      deliveryId: string;
      id: string;
      payload: UpdateDeliveryInput;
    }): Promise<BookView> =>
      BookViewSchema.parse(
        await bookDeliveryControllerUpdate(input.id, input.deliveryId, input.payload),
      ),
    onSuccess: sync,
  });
}
