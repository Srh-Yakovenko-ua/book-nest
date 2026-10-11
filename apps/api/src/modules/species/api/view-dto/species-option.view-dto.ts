import { SpeciesOptionViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SpeciesOptionViewDto extends createZodDto(SpeciesOptionViewSchema) {}
