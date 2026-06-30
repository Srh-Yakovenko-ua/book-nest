import { BulkTagsInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BulkTagsInputDto extends createZodDto(BulkTagsInputSchema) {}
