import { AuthorBookSuggestionViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class AuthorBookSuggestionViewDto extends createZodDto(AuthorBookSuggestionViewSchema) {}
