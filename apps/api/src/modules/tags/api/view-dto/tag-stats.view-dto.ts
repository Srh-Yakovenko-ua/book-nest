import { TagStatsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class TagStatsViewDto extends createZodDto(TagStatsViewSchema) {}
