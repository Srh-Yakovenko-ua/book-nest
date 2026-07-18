import { CreateNoteInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CreateNoteInputDto extends createZodDto(CreateNoteInputSchema) {}
