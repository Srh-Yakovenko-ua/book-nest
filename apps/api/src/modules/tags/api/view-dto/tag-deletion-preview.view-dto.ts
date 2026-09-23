import { TagDeletionPreviewViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class TagDeletionPreviewViewDto extends createZodDto(TagDeletionPreviewViewSchema) {}
