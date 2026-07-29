import { QuoteDeletionResultSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class QuoteDeletionResultDto extends createZodDto(QuoteDeletionResultSchema) {}
