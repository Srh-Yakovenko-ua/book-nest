import { DeliveryViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class DeliveryViewDto extends createZodDto(DeliveryViewSchema) {}
