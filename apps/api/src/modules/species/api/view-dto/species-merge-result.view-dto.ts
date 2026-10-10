import { SpeciesMergeResultSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SpeciesMergeResultDto extends createZodDto(SpeciesMergeResultSchema) {}
