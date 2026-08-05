import { TrashSummaryViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class TrashSummaryViewDto extends createZodDto(TrashSummaryViewSchema) {}
