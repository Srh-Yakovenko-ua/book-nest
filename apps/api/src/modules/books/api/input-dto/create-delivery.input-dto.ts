import { CreateDeliveryInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CreateDeliveryInputDto extends createZodDto(CreateDeliveryInputSchema) {}
