import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { DeliveryServicesController } from "./api/delivery-services.controller.js";
import { DeliveryServicesService } from "./application/delivery-services.service.js";
import { DeliveryServicesRepository } from "./infrastructure/delivery-services.repository.js";

@Module({
  controllers: [DeliveryServicesController],
  exports: [DeliveryServicesService],
  imports: [AuthModule],
  providers: [DeliveryServicesService, DeliveryServicesRepository],
})
export class DeliveryServicesModule {}
