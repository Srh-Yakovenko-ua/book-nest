import { SeriesCharactersQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SeriesCharactersQueryDto extends createZodDto(SeriesCharactersQuerySchema) {}
