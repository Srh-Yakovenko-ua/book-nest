import { MarkBoughtInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class MarkBoughtInputDto extends createZodDto(MarkBoughtInputSchema) {}
