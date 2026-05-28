import type { INestApplication } from "@nestjs/common";

import { getDataSourceToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

export async function truncateAllTables(app: INestApplication): Promise<void> {
  const dataSource = app.get<DataSource>(getDataSourceToken());
  const tables = dataSource.entityMetadatas.map((meta) => `"${meta.tableName}"`).join(", ");
  await dataSource.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE;`);
}
