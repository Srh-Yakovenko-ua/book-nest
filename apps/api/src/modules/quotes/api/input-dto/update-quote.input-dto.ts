import { UpdateQuoteInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpdateQuoteInputDto extends createZodDto(UpdateQuoteInputSchema) {}
