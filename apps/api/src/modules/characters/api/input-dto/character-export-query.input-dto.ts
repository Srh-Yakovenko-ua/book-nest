import { CharacterExportQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterExportQueryDto extends createZodDto(CharacterExportQuerySchema) {}
