import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { DeliveryServicesModule } from "../delivery-services/index.js";
import { MediaModule } from "../media/index.js";
import { BookBudgetsController } from "./api/book-budgets.controller.js";
import { BookOrderItemsController } from "./api/book-order-items.controller.js";
import { BookOrdersController } from "./api/book-orders.controller.js";
import { DeliveryReadController } from "./api/delivery-read.controller.js";
import { ShipmentsController } from "./api/shipments.controller.js";
import { BookBudgetService } from "./application/book-budget.service.js";
import { BookOrderItemService } from "./application/book-order-item.service.js";
import { BookOrderViewLoader } from "./application/book-order-view.loader.js";
import { BookOrderService } from "./application/book-order.service.js";
import { DeliveryReadService } from "./application/delivery-read.service.js";
import { DeliveryStatisticsService } from "./application/delivery-statistics.service.js";
import { ShipmentDeliveryServiceResolver } from "./application/shipment-delivery-service.resolver.js";
import { ShipmentService } from "./application/shipment.service.js";
import { SingleBookOrderService } from "./application/single-book-order.service.js";
import { BookBudgetsRepository } from "./infrastructure/book-budgets.repository.js";
import { BookOrderItemsRepository } from "./infrastructure/book-order-items.repository.js";
import { BookOrdersRepository } from "./infrastructure/book-orders.repository.js";
import { DeliveryReadRepository } from "./infrastructure/delivery-read.repository.js";
import { DeliveryStatisticsRepository } from "./infrastructure/delivery-statistics.repository.js";
import { OrderBooksRepository } from "./infrastructure/order-books.repository.js";
import { ShipmentsRepository } from "./infrastructure/shipments.repository.js";

@Module({
  controllers: [
    BookBudgetsController,
    DeliveryReadController,
    BookOrdersController,
    ShipmentsController,
    BookOrderItemsController,
  ],
  exports: [
    BookOrderService,
    BookOrderItemService,
    BookOrderItemsRepository,
    SingleBookOrderService,
  ],
  imports: [AuthModule, MediaModule, DeliveryServicesModule],
  providers: [
    BookBudgetService,
    BookBudgetsRepository,
    BookOrderService,
    ShipmentService,
    BookOrderItemService,
    SingleBookOrderService,
    DeliveryReadService,
    DeliveryStatisticsService,
    BookOrderViewLoader,
    ShipmentDeliveryServiceResolver,
    BookOrdersRepository,
    ShipmentsRepository,
    BookOrderItemsRepository,
    OrderBooksRepository,
    DeliveryReadRepository,
    DeliveryStatisticsRepository,
  ],
})
export class DeliveryModule {}
