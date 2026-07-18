import { CharacterDeletionPreviewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterDeletionPreviewDto extends createZodDto(CharacterDeletionPreviewSchema) {}
