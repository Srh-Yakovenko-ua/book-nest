import { CharacterBooksQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterBooksQueryDto extends createZodDto(CharacterBooksQuerySchema) {}
