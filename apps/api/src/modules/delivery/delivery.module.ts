import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { MediaModule } from "../media/index.js";
import { DeliveryController } from "./api/delivery.controller.js";
import { DeliveryService } from "./application/delivery.service.js";
import { DeliveryRepository } from "./infrastructure/delivery.repository.js";

@Module({
  controllers: [DeliveryController],
  imports: [AuthModule, MediaModule],
  providers: [DeliveryService, DeliveryRepository],
})
export class DeliveryModule {}
