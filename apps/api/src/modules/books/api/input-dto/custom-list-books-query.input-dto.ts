import { CustomListBooksQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CustomListBooksQueryDto extends createZodDto(CustomListBooksQuerySchema) {}
