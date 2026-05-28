import { SnakeNamingStrategy } from "typeorm-naming-strategies";
import { type PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions.js";

import { env } from "../../config/env.js";

export const databaseEntities: PostgresConnectionOptions["entities"] = [];

const SERVERLESS_POOL_SIZE = 1;
const MIGRATION_PATH_GLOB = "src/core/database/migrations/*.ts";
const MIGRATIONS_TABLE = "typeorm_migrations";

export function buildMigrationOptions(): PostgresConnectionOptions {
  return {
    ...basePostgresOptions(),
    logging: ["error", "migration", "schema"],
    url: env.directUrl ?? env.databaseUrl,
  };
}

export function buildRuntimeOptions(): PostgresConnectionOptions {
  return {
    ...basePostgresOptions(),
    extra: { max: SERVERLESS_POOL_SIZE },
    logging: false,
    url: env.databaseUrl,
  };
}

function basePostgresOptions(): Pick<
  PostgresConnectionOptions,
  "entities" | "migrations" | "migrationsTableName" | "namingStrategy" | "synchronize" | "type"
> {
  return {
    entities: databaseEntities,
    migrations: [MIGRATION_PATH_GLOB],
    migrationsTableName: MIGRATIONS_TABLE,
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
    type: "postgres",
  };
}
