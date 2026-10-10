import { Injectable, type OnModuleInit } from "@nestjs/common";

import type { SpeciesCategoryLabels } from "../domain/species.mapper.js";

import { readSpeciesCatalog } from "./species-catalog-file.js";

@Injectable()
export class SpeciesCategoryLabelsSource implements OnModuleInit {
  private labels: SpeciesCategoryLabels = new Map();

  load(): SpeciesCategoryLabels {
    return this.labels;
  }

  async onModuleInit(): Promise<void> {
    this.labels = await readCategoryLabels();
  }
}

async function readCategoryLabels(): Promise<SpeciesCategoryLabels> {
  const catalog = await readSpeciesCatalog();
  return new Map(
    catalog.categories.map((category) => [
      category.key,
      { en: category.nameEn, uk: category.nameUk },
    ]),
  );
}
