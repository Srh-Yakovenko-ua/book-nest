import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { AuthorsModule } from "../authors/authors.module.js";
import { GenresModule } from "../genres/genres.module.js";
import { ListsModule } from "../lists/lists.module.js";
import { MediaModule } from "../media/media.module.js";
import { PublishersModule } from "../publishers/publishers.module.js";
import { SeriesModule } from "../series/series.module.js";
import { TagsModule } from "../tags/tags.module.js";
import { BooksController } from "./api/books.controller.js";
import { BulkBooksController } from "./api/bulk-books.controller.js";
import { BooksService } from "./application/books.service.js";
import { BulkBooksService } from "./application/bulk-books.service.js";
import { BooksRepository } from "./infrastructure/books.repository.js";
import { BulkBooksRepository } from "./infrastructure/bulk-books.repository.js";

@Module({
  controllers: [BooksController, BulkBooksController],
  imports: [
    AuthModule,
    AuthorsModule,
    PublishersModule,
    TagsModule,
    SeriesModule,
    ListsModule,
    GenresModule,
    MediaModule,
  ],
  providers: [BooksService, BooksRepository, BulkBooksService, BulkBooksRepository],
})
export class BooksModule {}
