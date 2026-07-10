import { DeliveryInTransitSummaryViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class DeliveryInTransitSummaryViewDto extends createZodDto(
  DeliveryInTransitSummaryViewSchema,
) {}
