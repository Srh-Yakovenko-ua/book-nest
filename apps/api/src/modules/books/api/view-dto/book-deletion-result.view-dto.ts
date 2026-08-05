import { BookDeletionResultSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookDeletionResultDto extends createZodDto(BookDeletionResultSchema) {}
