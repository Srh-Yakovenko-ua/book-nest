import type { Nullable } from "@app/shared";

import type { PrismaService } from "../../../core/database/prisma.service.js";

type PublisherNameSeed = {
  isPrimary: boolean;
  locale: string;
  name: string;
  normalizedName: string;
};

type SeedBookInput = {
  createdAt?: Date;
  currency?: Nullable<string>;
  finishedAt?: Nullable<Date>;
  hasProgress?: boolean;
  ownershipStatus?: string;
  partNumber?: Nullable<number>;
  price?: Nullable<number>;
  prisma: PrismaService;
  publisherId?: Nullable<string>;
  queuePosition?: Nullable<number>;
  rating?: Nullable<number>;
  readingStatus?: string;
  seriesId?: Nullable<string>;
  title?: string;
  userId: string;
};

type SeedPublisherInput = {
  countryCode?: Nullable<string>;
  foundedYear?: Nullable<number>;
  name: string;
  names?: PublisherNameSeed[];
  normalizedName: string;
  prisma: PrismaService;
  searchText?: string;
  userId?: Nullable<string>;
  websiteUrl?: Nullable<string>;
};

type SeedSeriesInput = {
  name: string;
  prisma: PrismaService;
  userId: string;
};

export function seedBook(input: SeedBookInput): Promise<{ id: string }> {
  const wantsProgress =
    input.hasProgress === true || input.rating !== undefined || input.finishedAt !== undefined;
  const wantsPurchase = input.price !== undefined || input.currency !== undefined;

  return input.prisma.book.create({
    data: {
      createdAt: input.createdAt,
      ownershipStatus: input.ownershipStatus ?? "none",
      partNumber: input.partNumber ?? null,
      publisherId: input.publisherId ?? null,
      purchaseInfo: wantsPurchase
        ? { create: { currency: input.currency ?? null, expectedPrice: input.price ?? null } }
        : undefined,
      queuePosition: input.queuePosition ?? null,
      readingProgress: wantsProgress
        ? { create: { finishedAt: input.finishedAt ?? null, rating: input.rating ?? null } }
        : undefined,
      readingStatus: input.readingStatus ?? "not_started",
      seriesId: input.seriesId ?? null,
      title: input.title ?? "Untitled",
      userId: input.userId,
    },
    select: { id: true },
  });
}

export function seedPublisher(input: SeedPublisherInput): Promise<{ id: string }> {
  return input.prisma.publisher.create({
    data: {
      countryCode: input.countryCode ?? null,
      foundedYear: input.foundedYear ?? null,
      name: input.name,
      names: {
        create: input.names ?? [
          { isPrimary: true, locale: "uk", name: input.name, normalizedName: input.normalizedName },
        ],
      },
      normalizedName: input.normalizedName,
      searchText: input.searchText ?? input.normalizedName,
      userId: input.userId ?? null,
      websiteUrl: input.websiteUrl ?? null,
    },
    select: { id: true },
  });
}

export function seedSeries(input: SeedSeriesInput): Promise<{ id: string }> {
  return input.prisma.series.create({
    data: { name: input.name, normalizedName: input.name.toLowerCase(), userId: input.userId },
    select: { id: true },
  });
}
