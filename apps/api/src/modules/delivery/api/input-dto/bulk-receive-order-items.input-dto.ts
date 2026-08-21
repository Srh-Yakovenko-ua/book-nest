import { BulkReceiveOrderItemsInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BulkReceiveOrderItemsInputDto extends createZodDto(BulkReceiveOrderItemsInputSchema) {}
