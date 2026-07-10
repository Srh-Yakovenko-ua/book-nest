import { DeliveryInTransitQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class DeliveryInTransitQueryDto extends createZodDto(DeliveryInTransitQuerySchema) {}
