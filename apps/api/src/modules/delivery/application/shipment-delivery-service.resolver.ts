import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { DeliveryServicesService } from "../../delivery-services/index.js";

export type ShipmentDeliveryServiceSnapshot = {
  deliveryServiceId: Nullable<string>;
  deliveryServiceName: Nullable<string>;
};

const NO_DELIVERY_SERVICE: ShipmentDeliveryServiceSnapshot = {
  deliveryServiceId: null,
  deliveryServiceName: null,
};

@Injectable()
export class ShipmentDeliveryServiceResolver {
  constructor(private readonly deliveryServicesService: DeliveryServicesService) {}

  async resolve(
    { name, userId }: { name: Nullable<string> | undefined; userId: string },
    client: Prisma.TransactionClient,
  ): Promise<ShipmentDeliveryServiceSnapshot> {
    if (name === undefined || name === null) {
      return NO_DELIVERY_SERVICE;
    }

    const service = await this.deliveryServicesService.ensureCustomForName(
      { name, userId },
      client,
    );

    return { deliveryServiceId: service.id, deliveryServiceName: service.name };
  }

  async resolvePatch(
    { name, userId }: { name: Nullable<string> | undefined; userId: string },
    client: Prisma.TransactionClient,
  ): Promise<Partial<ShipmentDeliveryServiceSnapshot>> {
    if (name === undefined) {
      return {};
    }

    return this.resolve({ name, userId }, client);
  }
}
