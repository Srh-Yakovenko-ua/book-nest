import { UpdatePublisherInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpdatePublisherDto extends createZodDto(UpdatePublisherInputSchema) {}
