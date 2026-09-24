import { TagsSearchQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class TagsSearchQueryDto extends createZodDto(TagsSearchQuerySchema) {}
