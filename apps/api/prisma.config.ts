import "dotenv/config";
import { defineConfig, env } from "prisma/config";

type DatabaseEnv = {
  DATABASE_URL: string;
};

export default defineConfig({
  datasource: {
    url: env<DatabaseEnv>("DATABASE_URL"),
  },
  migrations: {
    path: "prisma/migrations",
  },
  schema: "prisma/schema.prisma",
});
