import { UpdateReadingProgressInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpdateReadingProgressInputDto extends createZodDto(UpdateReadingProgressInputSchema) {}
