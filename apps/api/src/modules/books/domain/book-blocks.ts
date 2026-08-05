import type {
  DeliveryInfoInput,
  DeliveryStatus,
  LoanInfoInput,
  Nullable,
  OwnershipStatus,
  PurchaseInfoInput,
  ReadingProgressInput,
  ReadingStatus,
  UpdateBookInput,
} from "@app/shared";

import { LoanTypeSchema, ownershipStatusKeepsPurchase, ownershipStatusUsesLoan } from "@app/shared";

import type {
  CreateDeliveryData,
  UpdateDeliveryData,
} from "../infrastructure/book-deliveries.repository.js";
import type {
  BlockUpsert,
  CreateLoanInfoData,
  CreatePurchaseInfoData,
  CreateReadingProgressData,
  DeliveryBlockChange,
  LoanBlockChange,
  UpdateLoanInfoData,
  UpdatePurchaseInfoData,
  UpdateReadingProgressData,
} from "../infrastructure/books.repository.js";

import { parseIsoDate } from "../../../core/iso-date.js";

type DefinedDeliveryInfo = NonNullable<DeliveryInfoInput>;
type DefinedLoanInfo = NonNullable<LoanInfoInput>;
type DefinedPurchaseInfo = NonNullable<PurchaseInfoInput>;
type DefinedReadingProgress = NonNullable<ReadingProgressInput>;

const STATUSES_WITH_READING_PROGRESS: ReadonlySet<ReadingStatus> = new Set([
  "dnf",
  "finished",
  "paused",
  "reading",
  "rereading",
]);

const OWNERSHIP_STATUS_IN_TRANSIT: OwnershipStatus = "in_transit";

const DEFAULT_DELIVERY_STATUS: DeliveryStatus = "ordered";

export const toCreateDate = (value: Nullable<string> | undefined): Nullable<Date> =>
  value === undefined || value === null ? null : parseIsoDate(value);

export const toUpdateDate = (value: Nullable<string> | undefined): Nullable<Date> | undefined =>
  value === undefined || value === null ? value : parseIsoDate(value);

export function buildDeliveryInfoData(deliveryInfo: DefinedDeliveryInfo): CreateDeliveryData {
  return {
    currency: deliveryInfo.currency ?? null,
    deliveryService: deliveryInfo.deliveryService ?? null,
    expectedDeliveryDate: toCreateDate(deliveryInfo.expectedDeliveryDate),
    note: deliveryInfo.note ?? null,
    orderDate: toCreateDate(deliveryInfo.orderDate),
    orderNumber: deliveryInfo.orderNumber ?? null,
    price: deliveryInfo.price ?? null,
    status: deliveryInfo.deliveryStatus ?? DEFAULT_DELIVERY_STATUS,
    storeName: deliveryInfo.storeName ?? null,
    trackingNumber: deliveryInfo.trackingNumber ?? null,
    trackingUrl: deliveryInfo.trackingUrl ?? null,
  };
}

export function buildDeliveryInfoUpdateData(deliveryInfo: DefinedDeliveryInfo): UpdateDeliveryData {
  return {
    currency: deliveryInfo.currency,
    deliveryService: deliveryInfo.deliveryService,
    expectedDeliveryDate: toUpdateDate(deliveryInfo.expectedDeliveryDate),
    note: deliveryInfo.note,
    orderDate: toUpdateDate(deliveryInfo.orderDate),
    orderNumber: deliveryInfo.orderNumber,
    price: deliveryInfo.price,
    status: deliveryInfo.deliveryStatus,
    storeName: deliveryInfo.storeName,
    trackingNumber: deliveryInfo.trackingNumber,
    trackingUrl: deliveryInfo.trackingUrl,
  };
}

export function buildLoanInfoData(loanInfo: DefinedLoanInfo): CreateLoanInfoData {
  return {
    contact: null,
    expectedReturnDate: toCreateDate(loanInfo.expectedReturnDate),
    loanDate: toCreateDate(loanInfo.loanDate),
    note: loanInfo.note ?? null,
    personName: loanInfo.personName ?? "",
    remindToReturn: false,
  };
}

export function buildLoanInfoUpdateData(loanInfo: DefinedLoanInfo): UpdateLoanInfoData {
  return {
    expectedReturnDate: toUpdateDate(loanInfo.expectedReturnDate),
    loanDate: toUpdateDate(loanInfo.loanDate),
    note: loanInfo.note,
    personName: loanInfo.personName,
  };
}

export function buildPurchaseInfoData(purchaseInfo: DefinedPurchaseInfo): CreatePurchaseInfoData {
  return {
    currency: purchaseInfo.currency ?? null,
    expectedPrice: purchaseInfo.expectedPrice ?? null,
    note: purchaseInfo.note ?? null,
    storeName: purchaseInfo.storeName ?? null,
    storeUrl: purchaseInfo.storeUrl ?? null,
  };
}

export function buildPurchaseInfoUpdateData(
  purchaseInfo: DefinedPurchaseInfo,
): UpdatePurchaseInfoData {
  return {
    currency: purchaseInfo.currency,
    expectedPrice: purchaseInfo.expectedPrice,
    note: purchaseInfo.note,
    storeName: purchaseInfo.storeName,
    storeUrl: purchaseInfo.storeUrl,
  };
}

export function buildReadingProgressData(
  readingProgress: DefinedReadingProgress,
): CreateReadingProgressData {
  return {
    abandonedAt: toCreateDate(readingProgress.abandonedAt),
    currentPage: readingProgress.currentPage ?? null,
    finishedAt: toCreateDate(readingProgress.finishedAt),
    impression: readingProgress.impression ?? null,
    lastProgressUpdateAt: null,
    note: readingProgress.note ?? null,
    pausedAt: toCreateDate(readingProgress.pausedAt),
    rating: readingProgress.rating ?? null,
    startedAt: toCreateDate(readingProgress.startedAt),
  };
}

export function buildReadingProgressUpdateData(
  readingProgress: DefinedReadingProgress,
): UpdateReadingProgressData {
  return {
    abandonedAt: toUpdateDate(readingProgress.abandonedAt),
    currentPage: readingProgress.currentPage,
    finishedAt: toUpdateDate(readingProgress.finishedAt),
    impression: readingProgress.impression,
    note: readingProgress.note,
    pausedAt: toUpdateDate(readingProgress.pausedAt),
    rating: readingProgress.rating,
    startedAt: toUpdateDate(readingProgress.startedAt),
  };
}

export function ownershipStatusUsesDelivery(ownershipStatus: OwnershipStatus): boolean {
  return ownershipStatus === OWNERSHIP_STATUS_IN_TRANSIT;
}

export function readingStatusUsesProgress(readingStatus: ReadingStatus): boolean {
  return STATUSES_WITH_READING_PROGRESS.has(readingStatus);
}

export function resolveDeliveryBlock({
  deliveryInfo,
  now,
  ownershipStatus,
}: {
  deliveryInfo: UpdateBookInput["deliveryInfo"];
  now: Date;
  ownershipStatus: OwnershipStatus;
}): DeliveryBlockChange {
  if (!ownershipStatusUsesDelivery(ownershipStatus)) {
    return { cancelledAt: now, kind: "cancel" };
  }
  if (deliveryInfo === undefined) {
    return { kind: "skip" };
  }
  return {
    create: buildDeliveryInfoData(deliveryInfo),
    kind: "upsertActive",
    update: buildDeliveryInfoUpdateData(deliveryInfo),
  };
}

export function resolveLoanBlock({
  loanInfo,
  now,
  ownershipStatus,
}: {
  loanInfo: UpdateBookInput["loanInfo"];
  now: Date;
  ownershipStatus: OwnershipStatus;
}): LoanBlockChange {
  if (!ownershipStatusUsesLoan(ownershipStatus)) {
    return { kind: "return", returnedAt: now };
  }
  const type = LoanTypeSchema.parse(ownershipStatus);
  if (loanInfo === undefined) {
    return { kind: "syncType", type };
  }
  return {
    create: buildLoanInfoData(loanInfo),
    kind: "upsertActive",
    type,
    update: buildLoanInfoUpdateData(loanInfo),
  };
}

export function resolvePurchaseBlock({
  ownershipStatus,
  purchaseInfo,
}: {
  ownershipStatus: OwnershipStatus;
  purchaseInfo: UpdateBookInput["purchaseInfo"];
}): BlockUpsert<CreatePurchaseInfoData, UpdatePurchaseInfoData> {
  if (!ownershipStatusKeepsPurchase(ownershipStatus)) {
    return { delete: true };
  }
  if (purchaseInfo === undefined) {
    return { skip: true };
  }
  return {
    create: buildPurchaseInfoData(purchaseInfo),
    update: buildPurchaseInfoUpdateData(purchaseInfo),
  };
}

export function resolveReadingProgressBlock({
  readingProgress,
  readingStatus,
}: {
  readingProgress: UpdateBookInput["readingProgress"];
  readingStatus: ReadingStatus;
}): BlockUpsert<CreateReadingProgressData, UpdateReadingProgressData> {
  if (!readingStatusUsesProgress(readingStatus)) {
    return { delete: true };
  }
  if (readingProgress === undefined) {
    return { skip: true };
  }
  return {
    create: buildReadingProgressData(readingProgress),
    update: buildReadingProgressUpdateData(readingProgress),
  };
}

export { ownershipStatusKeepsPurchase, ownershipStatusUsesLoan };
