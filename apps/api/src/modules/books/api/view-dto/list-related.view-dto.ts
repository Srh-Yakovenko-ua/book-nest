import { ListRelatedViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ListRelatedViewDto extends createZodDto(ListRelatedViewSchema) {}
