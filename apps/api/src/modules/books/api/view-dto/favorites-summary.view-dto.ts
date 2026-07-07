import { FavoritesSummaryViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class FavoritesSummaryViewDto extends createZodDto(FavoritesSummaryViewSchema) {}
