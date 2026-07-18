import { EntityNotesViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class EntityNotesViewDto extends createZodDto(EntityNotesViewSchema) {}
