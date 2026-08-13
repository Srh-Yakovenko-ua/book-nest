import { CreateBookOrderInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CreateBookOrderInputDto extends createZodDto(CreateBookOrderInputSchema) {}
