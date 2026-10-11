import { SpeciesNameInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SpeciesNameDto extends createZodDto(SpeciesNameInputSchema) {}
