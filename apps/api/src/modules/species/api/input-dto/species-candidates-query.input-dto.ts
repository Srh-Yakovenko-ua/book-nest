import { SpeciesCandidatesQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SpeciesCandidatesQueryDto extends createZodDto(SpeciesCandidatesQuerySchema) {}
