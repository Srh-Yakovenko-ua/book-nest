import { ReceiveDeliveryInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReceiveDeliveryInputDto extends createZodDto(ReceiveDeliveryInputSchema) {}
