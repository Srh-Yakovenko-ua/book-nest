import { AddBooksToListInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class AddBooksToListInputDto extends createZodDto(AddBooksToListInputSchema) {}
