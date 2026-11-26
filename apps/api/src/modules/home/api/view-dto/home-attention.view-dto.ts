import { HomeAttentionViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class HomeAttentionViewDto extends createZodDto(HomeAttentionViewSchema) {}
