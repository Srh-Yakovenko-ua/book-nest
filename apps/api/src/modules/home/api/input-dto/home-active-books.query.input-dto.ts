import { HomeActiveBooksQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class HomeActiveBooksQueryDto extends createZodDto(HomeActiveBooksQuerySchema) {}
