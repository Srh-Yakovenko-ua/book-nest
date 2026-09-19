import { CreateSeriesNoteInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CreateSeriesNoteInputDto extends createZodDto(CreateSeriesNoteInputSchema) {}
