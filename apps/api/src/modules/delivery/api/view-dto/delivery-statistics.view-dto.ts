import { DeliveryStatisticsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class DeliveryStatisticsViewDto extends createZodDto(DeliveryStatisticsViewSchema) {}
