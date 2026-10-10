import { SpeciesSearchQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SpeciesSearchQueryDto extends createZodDto(SpeciesSearchQuerySchema) {}
