import { SeriesCharacterGraphQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SeriesCharacterGraphQueryDto extends createZodDto(SeriesCharacterGraphQuerySchema) {}
