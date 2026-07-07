import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { AuthorsModule } from "../authors/index.js";
import { DeliveryServicesModule } from "../delivery-services/index.js";
import { GenresModule } from "../genres/index.js";
import { ListsModule } from "../lists/index.js";
import { MediaModule } from "../media/index.js";
import { PublishersModule } from "../publishers/index.js";
import { SeriesModule } from "../series/index.js";
import { TagsModule } from "../tags/index.js";
import { BookDeliveryController } from "./api/book-delivery.controller.js";
import { BookLoanController } from "./api/book-loan.controller.js";
import { BookOwnershipController } from "./api/book-ownership.controller.js";
import { BookReadingController } from "./api/book-reading.controller.js";
import { BooksController } from "./api/books.controller.js";
import { BulkBooksController } from "./api/bulk-books.controller.js";
import { ListDetailsController } from "./api/list-details.controller.js";
import { ListMembershipController } from "./api/list-membership.controller.js";
import { BookCoverCleanup } from "./application/book-cover-cleanup.js";
import { BookDeliveryService } from "./application/book-delivery.service.js";
import { BookLoanService } from "./application/book-loan.service.js";
import { BookOwnershipService } from "./application/book-ownership.service.js";
import { BookReadingService } from "./application/book-reading.service.js";
import { BookRelationsResolver } from "./application/book-relations-resolver.js";
import { BookViewAssembler } from "./application/book-view-assembler.js";
import { BooksService } from "./application/books.service.js";
import { BulkBooksService } from "./application/bulk-books.service.js";
import { ListDetailsService } from "./application/list-details.service.js";
import { ListMembershipService } from "./application/list-membership.service.js";
import { BookDeliveriesRepository } from "./infrastructure/book-deliveries.repository.js";
import { BooksRepository } from "./infrastructure/books.repository.js";
import { BulkBooksRepository } from "./infrastructure/bulk-books.repository.js";
import { ListBooksRepository } from "./infrastructure/list-books.repository.js";
import { ListMembershipRepository } from "./infrastructure/list-membership.repository.js";

@Module({
  controllers: [
    BooksController,
    BookReadingController,
    BookOwnershipController,
    BookLoanController,
    BookDeliveryController,
    BulkBooksController,
    ListDetailsController,
    ListMembershipController,
  ],
  exports: [BookReadingService, BookViewAssembler, BooksRepository],
  imports: [
    AuthModule,
    AuthorsModule,
    PublishersModule,
    TagsModule,
    SeriesModule,
    ListsModule,
    GenresModule,
    MediaModule,
    DeliveryServicesModule,
  ],
  providers: [
    BooksService,
    BookRelationsResolver,
    BookViewAssembler,
    BookCoverCleanup,
    BookReadingService,
    BookOwnershipService,
    BookLoanService,
    BookDeliveryService,
    BooksRepository,
    BookDeliveriesRepository,
    BulkBooksService,
    BulkBooksRepository,
    ListDetailsService,
    ListBooksRepository,
    ListMembershipService,
    ListMembershipRepository,
  ],
})
export class BooksModule {}
