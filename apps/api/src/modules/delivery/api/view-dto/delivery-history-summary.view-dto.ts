import { DeliveryHistorySummaryViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class DeliveryHistorySummaryViewDto extends createZodDto(DeliveryHistorySummaryViewSchema) {}
