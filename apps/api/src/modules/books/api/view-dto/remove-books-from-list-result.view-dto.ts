import { RemoveBooksFromListResultSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class RemoveBooksFromListResultDto extends createZodDto(RemoveBooksFromListResultSchema) {}
