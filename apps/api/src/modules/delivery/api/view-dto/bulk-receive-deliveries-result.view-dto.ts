import { BulkReceiveDeliveriesResultViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BulkReceiveDeliveriesResultViewDto extends createZodDto(
  BulkReceiveDeliveriesResultViewSchema,
) {}
