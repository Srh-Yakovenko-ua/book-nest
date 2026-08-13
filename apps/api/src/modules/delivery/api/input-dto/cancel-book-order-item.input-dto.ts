import { CancelBookOrderItemInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CancelBookOrderItemInputDto extends createZodDto(CancelBookOrderItemInputSchema) {}
