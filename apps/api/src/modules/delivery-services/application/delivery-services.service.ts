import type { DeliveryServiceView, Paginator, TaxonomySearchPaginationQuery } from "@app/shared";

import { normalizeName } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { toDeliveryServiceView } from "../domain/delivery-service.mapper.js";
import { DeliveryServicesRepository } from "../infrastructure/delivery-services.repository.js";

type EnsureCustomForNameInput = {
  name: string;
  userId: string;
};

@Injectable()
export class DeliveryServicesService {
  constructor(private readonly deliveryServicesRepository: DeliveryServicesRepository) {}

  async delete(userId: string, id: string): Promise<void> {
    const deletedCount = await this.deliveryServicesRepository.deleteOwnCustom({ id, userId });
    if (deletedCount === 0) {
      throw new NotFoundError("Delivery service not found");
    }
  }

  async ensureCustomForName(
    { name, userId }: EnsureCustomForNameInput,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    const normalizedName = normalizeName(name);
    const existing = await this.deliveryServicesRepository.findVisibleByNormalizedName(
      { normalizedName, userId },
      client,
    );
    if (existing !== null) {
      return;
    }
    await this.deliveryServicesRepository.upsertCustom({ name, normalizedName, userId }, client);
  }

  async recent({
    limit,
    userId,
  }: {
    limit: number;
    userId: string;
  }): Promise<DeliveryServiceView[]> {
    const snapshotNames = await this.deliveryServicesRepository.recentDeliveryServiceNames({
      limit,
      userId,
    });
    if (snapshotNames.length === 0) {
      return [];
    }

    const orderedNormalizedNames: string[] = [];
    const seenNormalizedNames = new Set<string>();
    for (const snapshotName of snapshotNames) {
      const normalizedName = normalizeName(snapshotName);
      if (seenNormalizedNames.has(normalizedName)) {
        continue;
      }
      seenNormalizedNames.add(normalizedName);
      orderedNormalizedNames.push(normalizedName);
    }

    const rows = await this.deliveryServicesRepository.findVisibleByNormalizedNames({
      normalizedNames: orderedNormalizedNames,
      userId,
    });
    const rowByNormalizedName = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!rowByNormalizedName.has(row.normalizedName)) {
        rowByNormalizedName.set(row.normalizedName, row);
      }
    }

    const views = orderedNormalizedNames.flatMap((normalizedName) => {
      const row = rowByNormalizedName.get(normalizedName);
      return row === undefined ? [] : [toDeliveryServiceView(row)];
    });
    return views.slice(0, limit);
  }

  async search(
    userId: string,
    query: TaxonomySearchPaginationQuery,
  ): Promise<Paginator<DeliveryServiceView>> {
    const { pageNumber, pageSize, search } = query;

    const [rows, totalCount] = await Promise.all([
      this.deliveryServicesRepository.search({
        query: search,
        userId,
        ...pageSlice({ pageNumber, pageSize }),
      }),
      this.deliveryServicesRepository.count({ query: search, userId }),
    ]);

    return buildPaginator({
      items: rows.map(toDeliveryServiceView),
      pageNumber,
      pageSize,
      totalCount,
    });
  }
}
