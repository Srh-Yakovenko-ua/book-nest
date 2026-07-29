import { TrashedBooksQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class TrashedBooksQueryDto extends createZodDto(TrashedBooksQuerySchema) {}
