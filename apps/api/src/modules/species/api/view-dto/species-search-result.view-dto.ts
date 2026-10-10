import { SpeciesSearchResultSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SpeciesSearchResultDto extends createZodDto(SpeciesSearchResultSchema) {}
