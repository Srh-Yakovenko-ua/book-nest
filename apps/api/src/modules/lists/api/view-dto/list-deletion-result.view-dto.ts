import { ListDeletionResultSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ListDeletionResultDto extends createZodDto(ListDeletionResultSchema) {}
