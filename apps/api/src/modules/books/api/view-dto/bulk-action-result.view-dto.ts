import { BulkActionResultSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BulkActionResultDto extends createZodDto(BulkActionResultSchema) {}
