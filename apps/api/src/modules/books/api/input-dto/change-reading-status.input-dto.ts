import { ChangeReadingStatusInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ChangeReadingStatusInputDto extends createZodDto(ChangeReadingStatusInputSchema) {}
