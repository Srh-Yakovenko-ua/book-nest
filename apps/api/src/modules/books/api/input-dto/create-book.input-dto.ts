import { CreateBookInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CreateBookInputDto extends createZodDto(CreateBookInputSchema) {}
