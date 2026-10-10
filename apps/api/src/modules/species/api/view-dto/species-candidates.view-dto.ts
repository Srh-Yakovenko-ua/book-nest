import { SpeciesCandidatesSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SpeciesCandidatesDto extends createZodDto(SpeciesCandidatesSchema) {}
