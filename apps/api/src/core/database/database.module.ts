import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { buildRuntimeOptions } from "./typeorm-options.js";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({ ...buildRuntimeOptions(), autoLoadEntities: true }),
    }),
  ],
})
export class DatabaseModule {}
