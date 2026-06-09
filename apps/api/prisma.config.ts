import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config({ path: `.env.${process.env.APP_ENV ?? "local"}` });

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
