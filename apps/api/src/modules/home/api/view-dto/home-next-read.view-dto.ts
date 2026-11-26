import { HomeNextReadViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class HomeNextReadViewDto extends createZodDto(HomeNextReadViewSchema) {}
