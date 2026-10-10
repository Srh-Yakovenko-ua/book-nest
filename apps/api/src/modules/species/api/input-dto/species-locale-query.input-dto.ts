import { SpeciesLocaleQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SpeciesLocaleQueryDto extends createZodDto(SpeciesLocaleQuerySchema) {}
