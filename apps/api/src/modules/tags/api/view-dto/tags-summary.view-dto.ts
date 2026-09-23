import { TagsSummaryViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class TagsSummaryViewDto extends createZodDto(TagsSummaryViewSchema) {}
