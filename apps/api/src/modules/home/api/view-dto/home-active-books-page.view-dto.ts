import { HomeActiveBooksPageSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class HomeActiveBooksPageDto extends createZodDto(HomeActiveBooksPageSchema) {}
