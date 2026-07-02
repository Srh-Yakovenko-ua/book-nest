import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { AuthorsModule } from "../authors/authors.module.js";
import { GenresModule } from "../genres/genres.module.js";
import { ListsModule } from "../lists/lists.module.js";
import { MediaModule } from "../media/media.module.js";
import { PublishersModule } from "../publishers/publishers.module.js";
import { SeriesModule } from "../series/series.module.js";
import { TagsModule } from "../tags/tags.module.js";
import { BookDeliveryController } from "./api/book-delivery.controller.js";
import { BookLoanController } from "./api/book-loan.controller.js";
import { BookOwnershipController } from "./api/book-ownership.controller.js";
import { BookReadingController } from "./api/book-reading.controller.js";
import { BooksController } from "./api/books.controller.js";
import { BulkBooksController } from "./api/bulk-books.controller.js";
import { BookDeliveryService } from "./application/book-delivery.service.js";
import { BookLoanService } from "./application/book-loan.service.js";
import { BookOwnershipService } from "./application/book-ownership.service.js";
import { BookReadingService } from "./application/book-reading.service.js";
import { BooksService } from "./application/books.service.js";
import { BulkBooksService } from "./application/bulk-books.service.js";
import { BookDeliveriesRepository } from "./infrastructure/book-deliveries.repository.js";
import { BooksRepository } from "./infrastructure/books.repository.js";
import { BulkBooksRepository } from "./infrastructure/bulk-books.repository.js";

@Module({
  controllers: [
    BooksController,
    BookReadingController,
    BookOwnershipController,
    BookLoanController,
    BookDeliveryController,
    BulkBooksController,
  ],
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
  providers: [
    BooksService,
    BookReadingService,
    BookOwnershipService,
    BookLoanService,
    BookDeliveryService,
    BooksRepository,
    BookDeliveriesRepository,
    BulkBooksService,
    BulkBooksRepository,
  ],
})
export class BooksModule {}
