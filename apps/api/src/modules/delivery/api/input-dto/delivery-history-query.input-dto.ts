import { DeliveryHistoryQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class DeliveryHistoryQueryDto extends createZodDto(DeliveryHistoryQuerySchema) {}
