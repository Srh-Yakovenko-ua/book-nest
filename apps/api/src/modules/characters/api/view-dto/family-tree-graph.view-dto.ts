import { FamilyTreeGraphViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class FamilyTreeGraphViewDto extends createZodDto(FamilyTreeGraphViewSchema) {}
