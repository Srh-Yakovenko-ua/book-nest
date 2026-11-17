import { DeliveryServiceViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class DeliveryServiceViewDto extends createZodDto(DeliveryServiceViewSchema) {}
