import { SeriesDeletionResultSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SeriesDeletionResultDto extends createZodDto(SeriesDeletionResultSchema) {}
