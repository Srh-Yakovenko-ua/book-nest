import { MarkShipmentReadyForPickupInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class MarkShipmentReadyForPickupInputDto extends createZodDto(
  MarkShipmentReadyForPickupInputSchema,
) {}
