import { UpdateBookInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpdateBookInputDto extends createZodDto(UpdateBookInputSchema) {}
