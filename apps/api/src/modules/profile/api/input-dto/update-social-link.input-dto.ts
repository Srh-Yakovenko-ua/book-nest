import { UpdateSocialLinkInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpdateSocialLinkInputDto extends createZodDto(UpdateSocialLinkInputSchema) {}
