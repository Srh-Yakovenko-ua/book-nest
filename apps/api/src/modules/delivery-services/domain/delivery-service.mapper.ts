import type { DeliveryServiceView } from "@app/shared";

import type { DeliveryServiceModel } from "../../../generated/prisma/models.js";

export function toDeliveryServiceView(deliveryService: DeliveryServiceModel): DeliveryServiceView {
  return {
    countryCode: deliveryService.countryCode,
    id: deliveryService.id,
    isCustom: deliveryService.userId !== null,
    name: deliveryService.name,
    providerKey: null,
    trackingUrlTemplate: null,
  };
}
