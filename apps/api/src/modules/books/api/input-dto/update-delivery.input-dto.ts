import { UpdateDeliveryInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpdateDeliveryInputDto extends createZodDto(UpdateDeliveryInputSchema) {}
