import { AddBooksToListResultSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class AddBooksToListResultDto extends createZodDto(AddBooksToListResultSchema) {}
