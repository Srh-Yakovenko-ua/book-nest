import "reflect-metadata";
import { DataSource } from "typeorm";

import { buildMigrationOptions } from "./typeorm-options.js";

const appDataSource = new DataSource(buildMigrationOptions());

export default appDataSource;
