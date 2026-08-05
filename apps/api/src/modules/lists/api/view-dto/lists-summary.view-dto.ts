import { ListsSummaryViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ListsSummaryViewDto extends createZodDto(ListsSummaryViewSchema) {}
