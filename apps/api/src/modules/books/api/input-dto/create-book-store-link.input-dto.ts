import { CreateBookStoreLinkInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CreateBookStoreLinkInputDto extends createZodDto(CreateBookStoreLinkInputSchema) {}
