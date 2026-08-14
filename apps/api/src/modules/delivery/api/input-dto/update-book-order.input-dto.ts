import { UpdateBookOrderInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpdateBookOrderInputDto extends createZodDto(UpdateBookOrderInputSchema) {}
