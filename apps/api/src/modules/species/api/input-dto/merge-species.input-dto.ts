import { MergeSpeciesInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class MergeSpeciesDto extends createZodDto(MergeSpeciesInputSchema) {}
