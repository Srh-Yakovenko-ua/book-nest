import type { CreateBookInput, QueuePriority, UpdateBookInput } from "@app/shared";

import {
  BOOK_PART_NUMBER_EXCEEDS_TOTAL_MESSAGE,
  BOOK_SERIES_PART_NUMBER_TAKEN_CODE,
} from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { BadRequestError } from "../../../core/exceptions/errors.js";
import { isUniqueConstraintErrorOn } from "../../../core/prisma-errors.js";
import { AuthorsService } from "../../authors/index.js";
import { GenresService } from "../../genres/index.js";
import { ListsService } from "../../lists/index.js";
import { MediaService } from "../../media/index.js";
import { PublishersService } from "../../publishers/index.js";
import { SeriesService } from "../../series/index.js";
import { TagsService } from "../../tags/index.js";
import { BooksRepository, type BookWithRelations } from "../infrastructure/books.repository.js";

const DEFAULT_QUEUE_PRIORITY: QueuePriority = "normal";
const DUPLICATE_PART_NUMBER_MESSAGE = "A book with this part number already exists in this series";
const BOOK_SERIES_PART_NUMBER_UNIQUE_CONSTRAINT = "books_series_id_part_number_key";

export type QueueRemoval = {
  fromPosition: number;
};

export type ResolvedBookCreate = {
  authorIds: string[];
  firstAuthorName: string;
  listIds: string[];
  partNumber: null | number;
  publisherId: null | string;
  queuePosition: null | number;
  queuePriority: null | QueuePriority;
  seriesId: null | string;
  tagIds: string[];
};

export type ResolvedBookUpdate = {
  authorIds: string[] | undefined;
  fields: Prisma.BookUncheckedUpdateManyInput;
  listIds: string[] | undefined;
  queueRemoval: null | QueueRemoval;
  seriesPlacement: SeriesPlacement;
  tagIds: string[] | undefined;
};

export type SeriesPlacement = {
  partNumber: null | number;
  seriesId: null | string;
};

type QueuePlacement = {
  queuePosition: null | number;
  queuePriority: null | QueuePriority;
};

@Injectable()
export class BookRelationsResolver {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly authorsService: AuthorsService,
    private readonly publishersService: PublishersService,
    private readonly tagsService: TagsService,
    private readonly seriesService: SeriesService,
    private readonly listsService: ListsService,
    private readonly genresService: GenresService,
    private readonly mediaService: MediaService,
  ) {}

  async mapSeriesPartNumberWriteError({
    error,
    excludeBookId,
    placement,
    userId,
  }: {
    error: unknown;
    excludeBookId: null | string;
    placement: SeriesPlacement;
    userId: string;
  }): Promise<unknown> {
    if (
      placement.seriesId === null ||
      placement.partNumber === null ||
      !isUniqueConstraintErrorOn(error, BOOK_SERIES_PART_NUMBER_UNIQUE_CONSTRAINT)
    ) {
      return error;
    }

    const conflict = await this.booksRepository.findSeriesPartNumberConflict(userId, {
      excludeBookId,
      partNumber: placement.partNumber,
      seriesId: placement.seriesId,
    });
    return this.seriesPartNumberTakenError({ conflict, partNumber: placement.partNumber });
  }

  async resolveForCreate({
    input,
    userId,
  }: {
    input: CreateBookInput;
    userId: string;
  }): Promise<ResolvedBookCreate> {
    const authors = await this.authorsService.resolveReferences({
      references: input.authors,
      userId,
    });

    const publisherId = await this.publishersService.resolveOrCreate(userId, {
      id: input.publisherId,
      name: input.publisherName,
    });

    const tagIds = await this.tagsService.resolveOrCreateMany(userId, input.tags);

    const listIds = await this.listsService.resolveListsForBook(userId, {
      listIds: input.listIds,
      newLists: input.newLists,
    });

    const queuePlacement = await this.resolveQueuePlacement({ input, userId });

    const series =
      input.bookType === "series_part"
        ? await this.seriesService.resolveForBook({
            fallbackAuthorIds: authors.map((author) => author.id),
            newSeries: input.newSeries,
            seriesId: input.seriesId,
            userId,
          })
        : null;
    const seriesId = series?.id ?? null;
    const partNumber = input.bookType === "series_part" ? (input.partNumber ?? null) : null;

    if (series !== null) {
      this.assertPartNumberWithinSeriesTotal({ partNumber, totalBooks: series.totalBooks });
    }
    await this.assertSeriesPartNumberUnique({
      excludeBookId: null,
      placement: { partNumber, seriesId },
      userId,
    });
    await this.genresService.assertGenresSelectable(userId, input.genres);

    if (input.coverMediaId != null) {
      await this.mediaService.assertOwned({ id: input.coverMediaId, userId });
    }

    return {
      authorIds: authors.map((author) => author.id),
      firstAuthorName: authors[0]?.name ?? "",
      listIds,
      partNumber,
      publisherId,
      queuePosition: queuePlacement.queuePosition,
      queuePriority: queuePlacement.queuePriority,
      seriesId,
      tagIds,
    };
  }

  async resolveForUpdate({
    bookId,
    current,
    input,
    userId,
  }: {
    bookId: string;
    current: BookWithRelations;
    input: UpdateBookInput;
    userId: string;
  }): Promise<ResolvedBookUpdate> {
    const fields: Prisma.BookUncheckedUpdateManyInput = {};

    let authorIds: string[] | undefined;
    if (input.authors !== undefined) {
      const authors = await this.authorsService.resolveReferences({
        references: input.authors,
        userId,
      });
      authorIds = authors.map((author) => author.id);
      fields.firstAuthorName = authors[0]?.name ?? "";
    }

    if (input.publisherId !== undefined || input.publisherName !== undefined) {
      fields.publisherId = await this.publishersService.resolveOrCreate(userId, {
        id: input.publisherId,
        name: input.publisherName,
      });
    }

    if (input.coverMediaId !== undefined) {
      if (input.coverMediaId !== null) {
        await this.mediaService.assertOwned({ id: input.coverMediaId, userId });
      }
      fields.coverMediaId = input.coverMediaId;
    }

    const tagIds =
      input.tags === undefined
        ? undefined
        : await this.tagsService.resolveOrCreateMany(userId, input.tags);

    const listIds =
      input.listIds === undefined && input.newLists === undefined
        ? undefined
        : await this.listsService.resolveListsForBook(userId, {
            listIds: input.listIds,
            newLists: input.newLists,
          });

    const seriesPlacement = await this.applySeriesFields({
      current,
      fallbackAuthorIds: authorIds ?? current.authors.map((bookAuthor) => bookAuthor.authorId),
      fields,
      input,
      userId,
    });
    const queueRemoval = await this.applyQueueFields({ current, fields, input, userId });
    await this.assertSeriesPartNumberUnique({
      excludeBookId: bookId,
      placement: seriesPlacement,
      userId,
    });

    if (input.genres !== undefined) {
      await this.genresService.assertGenresSelectable(userId, input.genres);
    }

    return { authorIds, fields, listIds, queueRemoval, seriesPlacement, tagIds };
  }

  private async applyQueueFields({
    current,
    fields,
    input,
    userId,
  }: {
    current: BookWithRelations;
    fields: Prisma.BookUncheckedUpdateManyInput;
    input: UpdateBookInput;
    userId: string;
  }): Promise<null | QueueRemoval> {
    const isQueued = current.queuePosition !== null;

    if (input.addToReadingQueue === false) {
      fields.queuePosition = null;
      fields.queuePriority = null;
      return current.queuePosition === null ? null : { fromPosition: current.queuePosition };
    }

    if (input.addToReadingQueue === true && !isQueued) {
      const lastPosition = await this.booksRepository.maxQueuePosition(userId);
      fields.queuePosition = lastPosition + 1;
      fields.queuePriority = input.queuePriority ?? DEFAULT_QUEUE_PRIORITY;
      return null;
    }

    if (isQueued && input.queuePriority !== undefined) {
      fields.queuePriority = input.queuePriority;
    }

    return null;
  }

  private async applySeriesFields({
    current,
    fallbackAuthorIds,
    fields,
    input,
    userId,
  }: {
    current: BookWithRelations;
    fallbackAuthorIds: string[];
    fields: Prisma.BookUncheckedUpdateManyInput;
    input: UpdateBookInput;
    userId: string;
  }): Promise<SeriesPlacement> {
    if (input.bookType === undefined) {
      if (current.seriesId !== null && input.partNumber !== undefined) {
        this.assertPartNumberWithinSeriesTotal({
          partNumber: input.partNumber,
          totalBooks: current.series?.totalBooks ?? null,
        });
        fields.partNumber = input.partNumber;
        return { partNumber: input.partNumber, seriesId: current.seriesId };
      }
      return { partNumber: current.partNumber, seriesId: current.seriesId };
    }

    if (input.bookType === "solo") {
      fields.seriesId = null;
      fields.partNumber = null;
      return { partNumber: null, seriesId: null };
    }

    const series = await this.seriesService.resolveForBook({
      fallbackAuthorIds,
      newSeries: input.newSeries,
      seriesId: input.seriesId,
      userId,
    });
    const partNumber = input.partNumber ?? null;
    this.assertPartNumberWithinSeriesTotal({ partNumber, totalBooks: series.totalBooks });
    fields.seriesId = series.id;
    fields.partNumber = partNumber;
    return { partNumber, seriesId: series.id };
  }

  private assertPartNumberWithinSeriesTotal({
    partNumber,
    totalBooks,
  }: {
    partNumber: null | number;
    totalBooks: null | number;
  }): void {
    if (totalBooks === null || partNumber === null) {
      return;
    }
    if (partNumber > totalBooks) {
      throw new BadRequestError(BOOK_PART_NUMBER_EXCEEDS_TOTAL_MESSAGE, {
        fields: [{ field: "partNumber", message: BOOK_PART_NUMBER_EXCEEDS_TOTAL_MESSAGE }],
      });
    }
  }

  private async assertSeriesPartNumberUnique({
    excludeBookId,
    placement,
    userId,
  }: {
    excludeBookId: null | string;
    placement: SeriesPlacement;
    userId: string;
  }): Promise<void> {
    if (placement.seriesId === null || placement.partNumber === null) {
      return;
    }

    const conflict = await this.booksRepository.findSeriesPartNumberConflict(userId, {
      excludeBookId,
      partNumber: placement.partNumber,
      seriesId: placement.seriesId,
    });
    if (conflict !== null) {
      throw this.seriesPartNumberTakenError({ conflict, partNumber: placement.partNumber });
    }
  }

  private async resolveQueuePlacement({
    input,
    userId,
  }: {
    input: CreateBookInput;
    userId: string;
  }): Promise<QueuePlacement> {
    if (!input.addToReadingQueue) {
      return { queuePosition: null, queuePriority: null };
    }

    const lastPosition = await this.booksRepository.maxQueuePosition(userId);
    return {
      queuePosition: lastPosition + 1,
      queuePriority: input.queuePriority ?? DEFAULT_QUEUE_PRIORITY,
    };
  }

  private seriesPartNumberTakenError({
    conflict,
    partNumber,
  }: {
    conflict: null | { id: string; title: string };
    partNumber: number;
  }): BadRequestError {
    return new BadRequestError(DUPLICATE_PART_NUMBER_MESSAGE, {
      fields: [
        {
          code: BOOK_SERIES_PART_NUMBER_TAKEN_CODE,
          field: "partNumber",
          message: DUPLICATE_PART_NUMBER_MESSAGE,
          meta:
            conflict === null
              ? undefined
              : {
                  bookId: conflict.id,
                  bookTitle: conflict.title,
                  partNumber: String(partNumber),
                },
        },
      ],
    });
  }
}
