import { HomeReadingViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class HomeReadingViewDto extends createZodDto(HomeReadingViewSchema) {}
