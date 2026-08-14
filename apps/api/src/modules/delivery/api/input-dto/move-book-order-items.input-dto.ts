import { MoveBookOrderItemsInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class MoveBookOrderItemsInputDto extends createZodDto(MoveBookOrderItemsInputSchema) {}
