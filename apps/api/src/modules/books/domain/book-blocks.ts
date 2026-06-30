import type {
  DeliveryInfoInput,
  LoanInfoInput,
  OwnershipStatus,
  PurchaseInfoInput,
  ReadingProgressInput,
  ReadingStatus,
} from "@app/shared";

import type {
  CreateDeliveryInfoData,
  CreateLoanInfoData,
  CreatePurchaseInfoData,
  CreateReadingProgressData,
  UpdateDeliveryInfoData,
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
const OWNERSHIP_STATUS_WANT_TO_BUY: OwnershipStatus = "want_to_buy";

const DEFAULT_DELIVERY_STATUS = "ordered";

const toCreateDate = (value: null | string | undefined): Date | null =>
  value === undefined || value === null ? null : parseIsoDate(value);

const toUpdateDate = (value: null | string | undefined): Date | null | undefined =>
  value === undefined || value === null ? value : parseIsoDate(value);

export function buildDeliveryInfoData(deliveryInfo: DefinedDeliveryInfo): CreateDeliveryInfoData {
  return {
    deliveryStatus: deliveryInfo.deliveryStatus ?? DEFAULT_DELIVERY_STATUS,
    expectedDeliveryDate: toCreateDate(deliveryInfo.expectedDeliveryDate),
    note: deliveryInfo.note ?? null,
    orderDate: toCreateDate(deliveryInfo.orderDate),
    orderNumber: deliveryInfo.orderNumber ?? null,
    storeName: deliveryInfo.storeName ?? null,
  };
}

export function buildDeliveryInfoUpdateData(
  deliveryInfo: DefinedDeliveryInfo,
): UpdateDeliveryInfoData {
  return {
    deliveryStatus: deliveryInfo.deliveryStatus,
    expectedDeliveryDate: toUpdateDate(deliveryInfo.expectedDeliveryDate),
    note: deliveryInfo.note,
    orderDate: toUpdateDate(deliveryInfo.orderDate),
    orderNumber: deliveryInfo.orderNumber,
    storeName: deliveryInfo.storeName,
  };
}

export function buildLoanInfoData(loanInfo: DefinedLoanInfo): CreateLoanInfoData {
  return {
    expectedReturnDate: toCreateDate(loanInfo.expectedReturnDate),
    loanDate: toCreateDate(loanInfo.loanDate),
    note: loanInfo.note ?? null,
    personName: loanInfo.personName ?? "",
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

export function ownershipStatusUsesPurchase(ownershipStatus: OwnershipStatus): boolean {
  return ownershipStatus === OWNERSHIP_STATUS_WANT_TO_BUY;
}

export function readingStatusUsesProgress(readingStatus: ReadingStatus): boolean {
  return STATUSES_WITH_READING_PROGRESS.has(readingStatus);
}

export { ownershipStatusUsesLoan } from "@app/shared";
