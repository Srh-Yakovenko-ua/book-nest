import { CreateQuoteInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CreateQuoteInputDto extends createZodDto(CreateQuoteInputSchema) {}
