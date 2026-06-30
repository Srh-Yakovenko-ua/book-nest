import { BulkListsInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BulkListsInputDto extends createZodDto(BulkListsInputSchema) {}
