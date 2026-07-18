import { CharactersListQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharactersListQueryDto extends createZodDto(CharactersListQuerySchema) {}
