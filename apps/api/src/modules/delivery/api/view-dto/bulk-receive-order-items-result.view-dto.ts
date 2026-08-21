import { BulkReceiveOrderItemsResultViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BulkReceiveOrderItemsResultViewDto extends createZodDto(
  BulkReceiveOrderItemsResultViewSchema,
) {}
