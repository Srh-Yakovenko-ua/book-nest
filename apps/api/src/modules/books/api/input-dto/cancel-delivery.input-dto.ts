import { CancelDeliveryInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CancelDeliveryInputDto extends createZodDto(CancelDeliveryInputSchema) {}
