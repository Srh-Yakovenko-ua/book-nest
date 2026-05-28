import "reflect-metadata";
import { DataSource } from "typeorm";

import { buildMigrationOptions } from "../core/database/typeorm-options.js";

export default async function setup(): Promise<void> {
  const dataSource = new DataSource(buildMigrationOptions());
  await dataSource.initialize();
  try {
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }
}
