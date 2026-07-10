import { BulkReceiveDeliveriesInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BulkReceiveDeliveriesInputDto extends createZodDto(BulkReceiveDeliveriesInputSchema) {}
