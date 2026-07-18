import { UpdateNoteInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpdateNoteInputDto extends createZodDto(UpdateNoteInputSchema) {}
