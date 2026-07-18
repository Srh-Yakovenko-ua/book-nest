import { z } from "zod";

export const ReadingStatusSchema = z.enum([
  "not_started",
  "want_to_read",
  "reading",
  "paused",
  "finished",
  "dnf",
  "rereading",
]);

export type ReadingStatus = z.infer<typeof ReadingStatusSchema>;

export const CLOSED_READING_STATUSES = [
  "finished",
  "dnf",
] as const satisfies readonly ReadingStatus[];

const CLOSED_READING_STATUS_SET: ReadonlySet<ReadingStatus> = new Set(CLOSED_READING_STATUSES);

export function isClosedReadingStatus(status: ReadingStatus): boolean {
  return CLOSED_READING_STATUS_SET.has(status);
}

export const OwnershipStatusSchema = z.enum([
  "none",
  "want_to_buy",
  "in_transit",
  "owned",
  "borrowed_from_someone",
  "lent_to_someone",
]);

export type OwnershipStatus = z.infer<typeof OwnershipStatusSchema>;

export const CurrencySchema = z.enum(["UAH", "EUR", "USD"]);

export type Currency = z.infer<typeof CurrencySchema>;

export const QueuePrioritySchema = z.enum(["low", "normal", "high"]);

export type QueuePriority = z.infer<typeof QueuePrioritySchema>;

export const QueuePriorityReasonSchema = z.enum([
  "book_club",
  "buddy_read",
  "event_or_deadline",
  "return_due",
  "series_order",
  "reading_goal",
  "anticipated_release",
  "other",
]);

export type QueuePriorityReason = z.infer<typeof QueuePriorityReasonSchema>;

export const QUEUE_PRIORITY_REASON_CUSTOM_TEXT_MAX = 300;

export const QUEUE_PRIORITY_DATE_REASONS = [
  "book_club",
  "buddy_read",
  "event_or_deadline",
  "return_due",
] as const satisfies readonly QueuePriorityReason[];

const QUEUE_PRIORITY_DATE_REASON_SET: ReadonlySet<QueuePriorityReason> = new Set(
  QUEUE_PRIORITY_DATE_REASONS,
);

export function queuePriorityReasonSupportsDate(reason: QueuePriorityReason): boolean {
  return QUEUE_PRIORITY_DATE_REASON_SET.has(reason);
}

export const DeliveryStatusSchema = z.enum([
  "ordered",
  "in_transit",
  "ready_for_pickup",
  "received",
  "cancelled",
]);

export type DeliveryStatus = z.infer<typeof DeliveryStatusSchema>;

export const DELIVERY_ACTIVE_STATUSES = ["ordered", "in_transit", "ready_for_pickup"] as const;

const DELIVERY_ACTIVE_STATUS_SET: ReadonlySet<DeliveryStatus> = new Set(DELIVERY_ACTIVE_STATUSES);

export const ActiveDeliveryStatusSchema = z.enum(DELIVERY_ACTIVE_STATUSES);

export type ActiveDeliveryStatus = z.infer<typeof ActiveDeliveryStatusSchema>;

export function isActiveDeliveryStatus(status: DeliveryStatus): status is ActiveDeliveryStatus {
  return DELIVERY_ACTIVE_STATUS_SET.has(status);
}

export const BookFormatSchema = z.enum(["paper", "ebook", "audiobook"]);

export type BookFormat = z.infer<typeof BookFormatSchema>;

export const BookFormatsSchema = z
  .array(BookFormatSchema)
  .refine(
    (formats) => new Set(formats).size === formats.length,
    "Formats must not contain duplicates",
  );

export const BookLanguageSchema = z.enum([
  "ukrainian",
  "english",
  "polish",
  "german",
  "french",
  "spanish",
  "other",
]);

export type BookLanguage = z.infer<typeof BookLanguageSchema>;

export const AgeCategorySchema = z.enum([
  "not_specified",
  "no_restrictions",
  "6_plus",
  "12_plus",
  "14_plus",
  "16_plus",
  "18_plus",
]);

export type AgeCategory = z.infer<typeof AgeCategorySchema>;

export const LoanDirectionSchema = z.enum(["borrowed", "lent"]);

export type LoanDirection = z.infer<typeof LoanDirectionSchema>;

export const LoanTypeSchema = z.enum(["borrowed_from_someone", "lent_to_someone"]);

export type LoanType = z.infer<typeof LoanTypeSchema>;

export const LoanStatusSchema = z.enum(["active", "returned"]);

export type LoanStatus = z.infer<typeof LoanStatusSchema>;

export const BookTypeSchema = z.enum(["solo", "series_part"]);

export type BookType = z.infer<typeof BookTypeSchema>;

const OWNERSHIP_STATUSES_WITH_LOAN: ReadonlySet<OwnershipStatus> = new Set<OwnershipStatus>([
  "borrowed_from_someone",
  "lent_to_someone",
]);

export function ownershipStatusUsesLoan(ownershipStatus: OwnershipStatus): boolean {
  return OWNERSHIP_STATUSES_WITH_LOAN.has(ownershipStatus);
}

const OWNERSHIP_STATUSES_WITH_PURCHASE: ReadonlySet<OwnershipStatus> = new Set<OwnershipStatus>([
  "owned",
  "want_to_buy",
]);

export function ownershipStatusKeepsPurchase(ownershipStatus: OwnershipStatus): boolean {
  return OWNERSHIP_STATUSES_WITH_PURCHASE.has(ownershipStatus);
}
