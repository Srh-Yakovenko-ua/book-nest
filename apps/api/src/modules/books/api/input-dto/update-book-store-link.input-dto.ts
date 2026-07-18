import { UpdateBookStoreLinkInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpdateBookStoreLinkInputDto extends createZodDto(UpdateBookStoreLinkInputSchema) {}
