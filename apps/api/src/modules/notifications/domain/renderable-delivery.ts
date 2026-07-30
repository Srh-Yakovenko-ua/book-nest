import type { NotificationPayload } from "@app/shared";

import type { PendingEmailDelivery } from "../infrastructure/notification-deliveries.repository.js";

import { toNotificationPayload } from "./notification.mapper.js";

export type ClaimedDelivery = {
  attempts: number;
  delivery: PendingEmailDelivery;
};

export type RenderableDelivery = {
  attempts: number;
  id: string;
  payload: NotificationPayload;
};

export function partitionRenderableDeliveries(claimed: readonly ClaimedDelivery[]): {
  renderable: RenderableDelivery[];
  unrenderable: PendingEmailDelivery[];
} {
  const renderable: RenderableDelivery[] = [];
  const unrenderable: PendingEmailDelivery[] = [];

  for (const { attempts, delivery } of claimed) {
    const payload = toNotificationPayload({
      params: delivery.notification.params,
      type: delivery.notification.type,
    });

    if (payload === null) {
      unrenderable.push(delivery);
      continue;
    }
    renderable.push({ attempts, id: delivery.id, payload });
  }

  return { renderable, unrenderable };
}
