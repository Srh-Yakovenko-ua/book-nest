import { BulkPagesCountResultSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BulkPagesCountResultDto extends createZodDto(BulkPagesCountResultSchema) {}
