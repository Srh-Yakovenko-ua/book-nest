import { RemoveBooksFromListInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class RemoveBooksFromListInputDto extends createZodDto(RemoveBooksFromListInputSchema) {}
