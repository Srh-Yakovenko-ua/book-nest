import { readFile } from "node:fs/promises";
import { z } from "zod";

const SPECIES_CATALOG_URL = new URL("../../../scripts/data/species-catalog.json", import.meta.url);

const SpeciesCatalogCategorySchema = z.object({
  count: z.number().int().positive(),
  key: z.string().min(1),
  nameEn: z.string().min(1),
  nameUk: z.string().min(1),
});

const SpeciesCatalogItemSchema = z.object({
  categoryEn: z.string().min(1),
  categoryKey: z.string().min(1),
  categoryUk: z.string().min(1),
  key: z.string().min(1),
  nameEn: z.string().min(1),
  nameUk: z.string().min(1),
});

const SpeciesCatalogSchema = z.object({
  categories: z.array(SpeciesCatalogCategorySchema).min(1),
  count: z.number().int().positive(),
  items: z.array(SpeciesCatalogItemSchema).min(1),
  version: z.number().int().positive(),
});

export type SpeciesCatalog = z.infer<typeof SpeciesCatalogSchema>;

export type SpeciesCatalogItem = z.infer<typeof SpeciesCatalogItemSchema>;

export async function readSpeciesCatalog(): Promise<SpeciesCatalog> {
  const raw = await readFile(SPECIES_CATALOG_URL, "utf8");
  return SpeciesCatalogSchema.parse(JSON.parse(raw));
}
