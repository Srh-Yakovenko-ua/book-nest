import type {
  BookView,
  DedicationsSummaryView,
  FavoritesSummaryView,
  LibraryOverviewView,
  Paginator,
  RecentPurchaseStores,
  WishlistView,
} from "@app/shared";

import {
  CreateBookInputSchema,
  DedicationsQuerySchema,
  LibraryBooksQuerySchema,
  LibraryOverviewQuerySchema,
  OwnershipStatusSchema,
  RecentPurchaseStoresQuerySchema,
  UpdateBookInputSchema,
} from "@app/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { seconds, Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { MUTATION_THROTTLE, READ_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { BooksService } from "../application/books.service.js";
import { DedicationsService } from "../application/dedications.service.js";
import { WishlistService } from "../application/wishlist.service.js";
import { CreateBookInputDto } from "./input-dto/create-book.input-dto.js";
import { DedicationsQueryDto } from "./input-dto/dedications-query.input-dto.js";
import { LibraryBooksQueryDto } from "./input-dto/library-books-query.input-dto.js";
import { LibraryOverviewQueryDto } from "./input-dto/library-overview-query.input-dto.js";
import { RecentPurchaseStoresQueryDto } from "./input-dto/recent-purchase-stores-query.input-dto.js";
import { UpdateBookInputDto } from "./input-dto/update-book.input-dto.js";
import { BookViewDto } from "./view-dto/book.view-dto.js";
import { DedicationsSummaryViewDto } from "./view-dto/dedications.view-dto.js";
import { FavoritesSummaryViewDto } from "./view-dto/favorites-summary.view-dto.js";
import { LibraryOverviewViewDto } from "./view-dto/library-overview.view-dto.js";
import { PaginatedBooksDto } from "./view-dto/paginated-books.view-dto.js";
import { WishlistViewDto } from "./view-dto/wishlist.view-dto.js";

const CREATE_BOOK_TTL_SECONDS = 60;
const CREATE_BOOK_LIMIT = 30;
@ApiTags("books")
@Controller("api/books")
export class BooksController {
  constructor(
    private readonly booksService: BooksService,
    private readonly wishlistService: WishlistService,
    private readonly dedicationsService: DedicationsService,
  ) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: CreateBookInputDto })
  @ApiCreatedResponse({ description: "The created book", type: BookViewDto })
  @ApiNotFoundResponse({ description: "Author or publisher not found" })
  @ApiOperation({ summary: "Create a book in the current user library" })
  @JwtProtected()
  @Post()
  @Throttle({ default: { limit: CREATE_BOOK_LIMIT, ttl: seconds(CREATE_BOOK_TTL_SECONDS) } })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(CreateBookInputSchema)) body: CreateBookInputDto,
  ): Promise<BookView> {
    return this.booksService.create(user.id, body);
  }
  @ApiOkResponse({ description: "A page of the current user books", type: PaginatedBooksDto })
  @ApiOperation({ summary: "List and filter the current user library" })
  @Get()
  @JwtProtected()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(LibraryBooksQuerySchema)) query: LibraryBooksQueryDto,
  ): Promise<Paginator<BookView>> {
    return this.booksService.list(user.id, query);
  }
  @ApiOkResponse({
    description: "Library overview for the current user",
    type: LibraryOverviewViewDto,
  })
  @ApiOperation({ summary: "Get the current user library overview" })
  @ApiQuery({
    description: "Scope the overview to these ownership statuses (physical library)",
    enum: OwnershipStatusSchema.options,
    isArray: true,
    name: "owner",
    required: false,
  })
  @Get("overview")
  @JwtProtected()
  overview(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(LibraryOverviewQuerySchema)) query: LibraryOverviewQueryDto,
  ): Promise<LibraryOverviewView> {
    return this.booksService.overview(user.id, query);
  }
  @ApiOkResponse({
    description: "Store names the current user recently used in purchase details",
    type: [String],
  })
  @ApiOperation({ summary: "List recently used purchase stores for the current user" })
  @ApiQuery({ name: "limit", required: false })
  @Get("purchase-stores")
  @JwtProtected()
  purchaseStores(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(RecentPurchaseStoresQuerySchema)) query: RecentPurchaseStoresQueryDto,
  ): Promise<RecentPurchaseStores> {
    return this.booksService.recentPurchaseStores({ limit: query.limit, userId: user.id });
  }
  @ApiOkResponse({
    description: "Favorites summary for the current user",
    type: FavoritesSummaryViewDto,
  })
  @ApiOperation({ summary: "Get the current user favorites summary" })
  @Get("favorites-summary")
  @JwtProtected()
  favoritesSummary(@CurrentUser() user: AuthenticatedUser): Promise<FavoritesSummaryView> {
    return this.booksService.favoritesSummary(user.id);
  }
  @ApiOkResponse({
    description: "The current user books-to-buy wishlist with a per-currency summary",
    type: WishlistViewDto,
  })
  @ApiOperation({ summary: "Get the current user books-to-buy wishlist" })
  @Get("wishlist")
  @JwtProtected()
  @Throttle(READ_THROTTLE)
  wishlist(@CurrentUser() user: AuthenticatedUser): Promise<WishlistView> {
    return this.wishlistService.getWishlist({ userId: user.id });
  }
  @ApiOkResponse({
    description: "A page of the current user books that carry a dedication",
    type: PaginatedBooksDto,
  })
  @ApiOperation({ summary: "List and filter the current user books that carry a dedication" })
  @Get("dedications")
  @JwtProtected()
  @Throttle(READ_THROTTLE)
  dedications(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(DedicationsQuerySchema)) query: DedicationsQueryDto,
  ): Promise<Paginator<BookView>> {
    return this.dedicationsService.getDedications({ query, userId: user.id });
  }
  @ApiOkResponse({
    description: "Dedications summary for the current user",
    type: DedicationsSummaryViewDto,
  })
  @ApiOperation({ summary: "Get the current user dedications summary" })
  @Get("dedications/summary")
  @JwtProtected()
  @Throttle(READ_THROTTLE)
  dedicationsSummary(@CurrentUser() user: AuthenticatedUser): Promise<DedicationsSummaryView> {
    return this.dedicationsService.getDedicationsSummary({ userId: user.id });
  }
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({ description: "The requested book", type: BookViewDto })
  @ApiOperation({ summary: "Get a book by id" })
  @Get(":id")
  @JwtProtected()
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<BookView> {
    return this.booksService.getById(user.id, id);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: UpdateBookInputDto })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({ description: "The updated book", type: BookViewDto })
  @ApiOperation({ summary: "Update a book in the current user library" })
  @JwtProtected()
  @Patch(":id")
  @Throttle(MUTATION_THROTTLE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(UpdateBookInputSchema)) body: UpdateBookInputDto,
  ): Promise<BookView> {
    return this.booksService.update(user.id, id, body);
  }
  @ApiNoContentResponse({ description: "The book was deleted" })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOperation({ summary: "Delete a book by id" })
  @Delete(":id")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @JwtProtected()
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.booksService.delete(user.id, id);
  }
}
