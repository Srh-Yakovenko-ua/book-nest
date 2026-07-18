import { WishlistViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class WishlistViewDto extends createZodDto(WishlistViewSchema) {}
