import type {
  DeliveryInfoInput,
  LoanInfoInput,
  OwnershipStatus,
  PurchaseInfoInput,
  ReadingProgressInput,
  ReadingStatus,
} from "@app/shared";

import type {
  CreateDeliveryData,
  UpdateDeliveryData,
} from "../infrastructure/book-deliveries.repository.js";
import type {
  CreateLoanInfoData,
  CreatePurchaseInfoData,
  CreateReadingProgressData,
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

const DEFAULT_DELIVERY_STATUS = "ordered";

export const toCreateDate = (value: null | string | undefined): Date | null =>
  value === undefined || value === null ? null : parseIsoDate(value);

export const toUpdateDate = (value: null | string | undefined): Date | null | undefined =>
  value === undefined || value === null ? value : parseIsoDate(value);

export function buildDeliveryInfoData(deliveryInfo: DefinedDeliveryInfo): CreateDeliveryData {
  return {
    currency: null,
    deliveryService: null,
    expectedDeliveryDate: toCreateDate(deliveryInfo.expectedDeliveryDate),
    note: deliveryInfo.note ?? null,
    orderDate: toCreateDate(deliveryInfo.orderDate),
    orderNumber: deliveryInfo.orderNumber ?? null,
    price: null,
    status: deliveryInfo.deliveryStatus ?? DEFAULT_DELIVERY_STATUS,
    storeName: deliveryInfo.storeName ?? null,
    trackingNumber: null,
    trackingUrl: null,
  };
}

export function buildDeliveryInfoUpdateData(deliveryInfo: DefinedDeliveryInfo): UpdateDeliveryData {
  return {
    expectedDeliveryDate: toUpdateDate(deliveryInfo.expectedDeliveryDate),
    note: deliveryInfo.note,
    orderDate: toUpdateDate(deliveryInfo.orderDate),
    orderNumber: deliveryInfo.orderNumber,
    status: deliveryInfo.deliveryStatus,
    storeName: deliveryInfo.storeName,
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

export { ownershipStatusKeepsPurchase, ownershipStatusUsesLoan } from "@app/shared";
