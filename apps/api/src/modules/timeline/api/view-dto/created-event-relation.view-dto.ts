import { CreatedEventRelationViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CreatedEventRelationViewDto extends createZodDto(CreatedEventRelationViewSchema) {}
