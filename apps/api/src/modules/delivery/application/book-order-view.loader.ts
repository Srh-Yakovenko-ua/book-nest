import type { BookOrderView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { toBookOrderView } from "../domain/order.mapper.js";
import { BookOrdersRepository } from "../infrastructure/book-orders.repository.js";
import { orderNotFoundError } from "./delivery-write-errors.js";

@Injectable()
export class BookOrderViewLoader {
  constructor(private readonly bookOrdersRepository: BookOrdersRepository) {}

  async loadOrThrow(
    { orderId, userId }: { orderId: string; userId: string },
    client?: Prisma.TransactionClient,
  ): Promise<BookOrderView> {
    const order = await this.bookOrdersRepository.findOwnedById({ orderId, userId }, client);
    if (order === null) {
      throw orderNotFoundError();
    }

    return toBookOrderView(order);
  }
}
