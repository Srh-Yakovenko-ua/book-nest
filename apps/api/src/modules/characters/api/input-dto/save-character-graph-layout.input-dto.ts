import { SaveCharacterGraphLayoutSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SaveCharacterGraphLayoutInputDto extends createZodDto(
  SaveCharacterGraphLayoutSchema,
) {}
