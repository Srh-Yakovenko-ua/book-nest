import type {
  BookAuthorReference,
  CreateBookInput,
  Nullable,
  QueuePriority,
  QueuePriorityReason,
  UpdateBookInput,
} from "@app/shared";

import {
  BOOK_PART_NUMBER_EXCEEDS_TOTAL_MESSAGE,
  BOOK_SERIES_PART_NUMBER_TAKEN_CODE,
  isClosedReadingStatus,
  QueuePriorityReasonSchema,
  QueuePrioritySchema,
} from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { BadRequestError } from "../../../core/exceptions/errors.js";
import { parseIsoDate, toNullableIsoDate } from "../../../core/iso-date.js";
import { isUniqueConstraintErrorOn } from "../../../core/prisma-errors.js";
import { AuthorsService } from "../../authors/index.js";
import { GenresService } from "../../genres/index.js";
import { ListsService } from "../../lists/index.js";
import { MediaService } from "../../media/index.js";
import { PublishersService } from "../../publishers/index.js";
import { SeriesService } from "../../series/index.js";
import { TagsService } from "../../tags/index.js";
import {
  EMPTY_QUEUE_PRIORITY_DETAILS,
  type QueuePriorityDetails,
  type QueuePriorityDetailsInput,
  resolveQueuePriorityDetails,
} from "../domain/queue-priority.js";
import { BooksRepository, type BookWithRelations } from "../infrastructure/books.repository.js";

const DEFAULT_QUEUE_PRIORITY: QueuePriority = "normal";
const DUPLICATE_PART_NUMBER_MESSAGE = "A book with this part number already exists in this series";
const BOOK_SERIES_PART_NUMBER_UNIQUE_CONSTRAINT = "books_series_id_part_number_key";

export type QueueRemoval = {
  fromPosition: number;
};

export type ResolvedAuthors = {
  authorIds: string[];
  firstAuthorName: string;
};

export type ResolvedBookCreate = {
  authorIds: string[];
  firstAuthorName: string;
  listIds: string[];
  partNumber: Nullable<number>;
  publisherId: Nullable<string>;
  queuePosition: Nullable<number>;
  queuePriority: Nullable<QueuePriority>;
  queuePriorityReason: Nullable<QueuePriorityReason>;
  queuePriorityReasonCustomText: Nullable<string>;
  queuePriorityTargetDate: Nullable<Date>;
  seriesId: Nullable<string>;
  tagIds: string[];
};

export type ResolvedBookUpdate = {
  authorIds: string[] | undefined;
  fields: Prisma.BookUncheckedUpdateManyInput;
  listIds: string[] | undefined;
  queueRemoval: Nullable<QueueRemoval>;
  seriesPlacement: SeriesPlacement;
  tagIds: string[] | undefined;
};

export type SeriesPlacement = {
  partNumber: Nullable<number>;
  seriesId: Nullable<string>;
};

type QueuePlacement = {
  queuePosition: Nullable<number>;
  queuePriority: Nullable<QueuePriority>;
  queuePriorityReason: Nullable<QueuePriorityReason>;
  queuePriorityReasonCustomText: Nullable<string>;
  queuePriorityTargetDate: Nullable<Date>;
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

  async assertCreatableRelations({
    input,
    userId,
  }: {
    input: CreateBookInput;
    userId: string;
  }): Promise<void> {
    await this.genresService.assertGenresSelectable(userId, input.genres);
    if (input.coverMediaId != null) {
      await this.mediaService.assertOwned({ id: input.coverMediaId, userId });
    }
  }

  async assertUpdatableRelations({
    input,
    userId,
  }: {
    input: UpdateBookInput;
    userId: string;
  }): Promise<void> {
    if (input.genres !== undefined) {
      await this.genresService.assertGenresSelectable(userId, input.genres);
    }
    if (input.coverMediaId != null) {
      await this.mediaService.assertOwned({ id: input.coverMediaId, userId });
    }
  }

  async mapSeriesPartNumberWriteError({
    error,
    excludeBookId,
    placement,
    userId,
  }: {
    error: unknown;
    excludeBookId: Nullable<string>;
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

  async resolveAuthors({
    references,
    userId,
  }: {
    references: BookAuthorReference[];
    userId: string;
  }): Promise<ResolvedAuthors> {
    const authors = await this.authorsService.resolveReferences({ references, userId });
    return {
      authorIds: authors.map((author) => author.id),
      firstAuthorName: authors[0]?.name ?? "",
    };
  }

  async resolveForCreate(
    {
      input,
      resolvedAuthors,
      userId,
    }: {
      input: CreateBookInput;
      resolvedAuthors: ResolvedAuthors;
      userId: string;
    },
    client?: Prisma.TransactionClient,
  ): Promise<ResolvedBookCreate> {
    const publisherId = await this.publishersService.resolveOrCreate(
      userId,
      {
        id: input.publisherId,
        name: input.publisherName,
      },
      client,
    );

    const tagIds = await this.tagsService.resolveOrCreateMany(userId, input.tags, client);

    const listIds = await this.listsService.resolveListsForBook(
      {
        input: { listIds: input.listIds, newLists: input.newLists },
        userId,
      },
      client,
    );

    const queuePlacement = await this.resolveQueuePlacement({ input, userId }, client);

    const series =
      input.bookType === "series_part"
        ? await this.seriesService.resolveForBook(
            {
              fallbackAuthorIds: resolvedAuthors.authorIds,
              newSeries: input.newSeries,
              seriesId: input.seriesId,
              userId,
            },
            client,
          )
        : null;
    const seriesId = series?.id ?? null;
    const partNumber = input.bookType === "series_part" ? (input.partNumber ?? null) : null;

    if (series !== null) {
      this.assertPartNumberWithinSeriesTotal({ partNumber, totalBooks: series.totalBooks });
    }
    await this.assertSeriesPartNumberUnique(
      {
        excludeBookId: null,
        placement: { partNumber, seriesId },
        userId,
      },
      client,
    );

    return {
      authorIds: resolvedAuthors.authorIds,
      firstAuthorName: resolvedAuthors.firstAuthorName,
      listIds,
      partNumber,
      publisherId,
      queuePosition: queuePlacement.queuePosition,
      queuePriority: queuePlacement.queuePriority,
      queuePriorityReason: queuePlacement.queuePriorityReason,
      queuePriorityReasonCustomText: queuePlacement.queuePriorityReasonCustomText,
      queuePriorityTargetDate: queuePlacement.queuePriorityTargetDate,
      seriesId,
      tagIds,
    };
  }

  async resolveForUpdate(
    {
      bookId,
      current,
      input,
      resolvedAuthors,
      userId,
    }: {
      bookId: string;
      current: BookWithRelations;
      input: UpdateBookInput;
      resolvedAuthors: ResolvedAuthors | undefined;
      userId: string;
    },
    client?: Prisma.TransactionClient,
  ): Promise<ResolvedBookUpdate> {
    const fields: Prisma.BookUncheckedUpdateManyInput = {};

    let authorIds: string[] | undefined;
    if (resolvedAuthors !== undefined) {
      authorIds = resolvedAuthors.authorIds;
      fields.firstAuthorName = resolvedAuthors.firstAuthorName;
    }

    if (input.publisherId !== undefined || input.publisherName !== undefined) {
      fields.publisherId = await this.publishersService.resolveOrCreate(
        userId,
        {
          id: input.publisherId,
          name: input.publisherName,
        },
        client,
      );
    }

    if (input.coverMediaId !== undefined) {
      fields.coverMediaId = input.coverMediaId;
    }

    const tagIds =
      input.tags === undefined
        ? undefined
        : await this.tagsService.resolveOrCreateMany(userId, input.tags, client);

    const listIds =
      input.listIds === undefined && input.newLists === undefined
        ? undefined
        : await this.listsService.resolveListsForBook(
            {
              input: { listIds: input.listIds, newLists: input.newLists },
              userId,
            },
            client,
          );

    const seriesPlacement = await this.applySeriesFields(
      {
        current,
        fallbackAuthorIds: authorIds ?? current.authors.map((bookAuthor) => bookAuthor.authorId),
        fields,
        input,
        userId,
      },
      client,
    );
    const queueRemoval = await this.applyQueueFields({ current, fields, input, userId }, client);
    await this.assertSeriesPartNumberUnique(
      {
        excludeBookId: bookId,
        placement: seriesPlacement,
        userId,
      },
      client,
    );

    return { authorIds, fields, listIds, queueRemoval, seriesPlacement, tagIds };
  }

  private async applyQueueFields(
    {
      current,
      fields,
      input,
      userId,
    }: {
      current: BookWithRelations;
      fields: Prisma.BookUncheckedUpdateManyInput;
      input: UpdateBookInput;
      userId: string;
    },
    client?: Prisma.TransactionClient,
  ): Promise<Nullable<QueueRemoval>> {
    const isQueued = current.queuePosition !== null;
    const detailsInput: QueuePriorityDetailsInput = {
      customText: input.queuePriorityReasonCustomText,
      reason: input.queuePriorityReason,
      targetDate: input.queuePriorityTargetDate,
    };

    if (input.addToReadingQueue === false) {
      fields.queuePosition = null;
      fields.queuePriority = null;
      this.assignQueuePriorityDetails({
        current,
        fields,
        input: detailsInput,
        resolvedPriority: null,
      });
      return current.queuePosition === null ? null : { fromPosition: current.queuePosition };
    }

    if (input.addToReadingQueue === true && !isQueued) {
      await this.booksRepository.acquireUserQueueLock(userId, client);
      const lastPosition = await this.booksRepository.maxQueuePosition(userId, client);
      const queuePriority = input.queuePriority ?? DEFAULT_QUEUE_PRIORITY;
      fields.queuePosition = lastPosition + 1;
      fields.queuePriority = queuePriority;
      this.assignQueuePriorityDetails({
        current,
        fields,
        input: detailsInput,
        resolvedPriority: queuePriority,
      });
      return null;
    }

    if (isQueued && input.queuePriority !== undefined) {
      fields.queuePriority = input.queuePriority;
      this.assignQueuePriorityDetails({
        current,
        fields,
        input: detailsInput,
        resolvedPriority: input.queuePriority,
      });
      return null;
    }

    if (
      input.queuePriorityReason !== undefined ||
      input.queuePriorityReasonCustomText !== undefined ||
      input.queuePriorityTargetDate !== undefined
    ) {
      this.assignQueuePriorityDetails({
        current,
        fields,
        input: detailsInput,
        resolvedPriority:
          current.queuePosition === null || current.queuePriority === null
            ? null
            : QueuePrioritySchema.parse(current.queuePriority),
      });
    }
    return null;
  }

  private async applySeriesFields(
    {
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
    },
    client?: Prisma.TransactionClient,
  ): Promise<SeriesPlacement> {
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

    const series = await this.seriesService.resolveForBook(
      {
        fallbackAuthorIds,
        newSeries: input.newSeries,
        seriesId: input.seriesId,
        userId,
      },
      client,
    );
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
    partNumber: Nullable<number>;
    totalBooks: Nullable<number>;
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

  private async assertSeriesPartNumberUnique(
    {
      excludeBookId,
      placement,
      userId,
    }: {
      excludeBookId: Nullable<string>;
      placement: SeriesPlacement;
      userId: string;
    },
    client?: Prisma.TransactionClient,
  ): Promise<void> {
    if (placement.seriesId === null || placement.partNumber === null) {
      return;
    }

    const conflict = await this.booksRepository.findSeriesPartNumberConflict(
      userId,
      {
        excludeBookId,
        partNumber: placement.partNumber,
        seriesId: placement.seriesId,
      },
      client,
    );
    if (conflict !== null) {
      throw this.seriesPartNumberTakenError({ conflict, partNumber: placement.partNumber });
    }
  }

  private assignQueuePriorityDetails({
    current,
    fields,
    input,
    resolvedPriority,
  }: {
    current: BookWithRelations;
    fields: Prisma.BookUncheckedUpdateManyInput;
    input: QueuePriorityDetailsInput;
    resolvedPriority: Nullable<QueuePriority>;
  }): void {
    const details = resolveQueuePriorityDetails({
      current: toQueuePriorityDetails(current),
      input,
      resolvedPriority,
    });
    fields.queuePriorityReason = details.reason;
    fields.queuePriorityReasonCustomText = details.customText;
    fields.queuePriorityTargetDate =
      details.targetDate === null ? null : parseIsoDate(details.targetDate);
  }

  private async resolveQueuePlacement(
    { input, userId }: { input: CreateBookInput; userId: string },
    client?: Prisma.TransactionClient,
  ): Promise<QueuePlacement> {
    const detailsInput: QueuePriorityDetailsInput = {
      customText: input.queuePriorityReasonCustomText,
      reason: input.queuePriorityReason,
      targetDate: input.queuePriorityTargetDate,
    };

    if (!input.addToReadingQueue || isClosedReadingStatus(input.readingStatus)) {
      const details = resolveQueuePriorityDetails({
        current: EMPTY_QUEUE_PRIORITY_DETAILS,
        input: detailsInput,
        resolvedPriority: null,
      });
      return { queuePosition: null, queuePriority: null, ...toQueuePlacementDetails(details) };
    }

    await this.booksRepository.acquireUserQueueLock(userId, client);
    const lastPosition = await this.booksRepository.maxQueuePosition(userId, client);
    const queuePriority = input.queuePriority ?? DEFAULT_QUEUE_PRIORITY;
    const details = resolveQueuePriorityDetails({
      current: EMPTY_QUEUE_PRIORITY_DETAILS,
      input: detailsInput,
      resolvedPriority: queuePriority,
    });
    return {
      queuePosition: lastPosition + 1,
      queuePriority,
      ...toQueuePlacementDetails(details),
    };
  }

  private seriesPartNumberTakenError({
    conflict,
    partNumber,
  }: {
    conflict: Nullable<{ id: string; title: string }>;
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

function toQueuePlacementDetails(details: QueuePriorityDetails): {
  queuePriorityReason: Nullable<QueuePriorityReason>;
  queuePriorityReasonCustomText: Nullable<string>;
  queuePriorityTargetDate: Nullable<Date>;
} {
  return {
    queuePriorityReason: details.reason,
    queuePriorityReasonCustomText: details.customText,
    queuePriorityTargetDate: details.targetDate === null ? null : parseIsoDate(details.targetDate),
  };
}

function toQueuePriorityDetails(current: BookWithRelations): QueuePriorityDetails {
  return {
    customText: current.queuePriorityReasonCustomText,
    reason:
      current.queuePriorityReason === null
        ? null
        : QueuePriorityReasonSchema.parse(current.queuePriorityReason),
    targetDate: toNullableIsoDate(current.queuePriorityTargetDate),
  };
}
