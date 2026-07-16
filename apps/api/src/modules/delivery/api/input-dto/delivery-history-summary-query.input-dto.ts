import { DeliveryHistorySummaryQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class DeliveryHistorySummaryQueryDto extends createZodDto(
  DeliveryHistorySummaryQuerySchema,
) {}
