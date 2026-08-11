import { WishlistFacetsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class WishlistFacetsViewDto extends createZodDto(WishlistFacetsViewSchema) {}
