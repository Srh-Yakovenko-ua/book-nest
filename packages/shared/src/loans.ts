import { z } from "zod";

import { LoanTypeSchema, OwnershipStatusSchema } from "./book-enums.js";
import { createPaginatedSchema, paginationQueryFields } from "./common.js";
import { MediaViewSchema } from "./media.js";

const LOAN_SEARCH_MAX = 100;
const LOAN_PERSON_QUERY_MAX = 100;

export const LoanUiStatusSchema = z.enum(["overdue", "return_soon", "no_return_date", "on_time"]);

export type LoanUiStatus = z.infer<typeof LoanUiStatusSchema>;

export const LoanInfoViewSchema = z.object({
  contact: z.string().nullable(),
  expectedReturnDate: z.string().nullable(),
  loanDate: z.string().nullable(),
  loanType: LoanTypeSchema,
  loanUiStatus: LoanUiStatusSchema,
  note: z.string().nullable(),
  personName: z.string(),
  remindBeforeDays: z.number().int().nullable(),
  remindToReturn: z.boolean(),
});

export type LoanInfoView = z.infer<typeof LoanInfoViewSchema>;

export const LoanFilterSchema = z.enum([
  "all",
  "return_soon",
  "overdue",
  "no_return_date",
  "has_reminder",
  "without_reminder",
]);

export type LoanFilter = z.infer<typeof LoanFilterSchema>;

export const LoanSortSchema = z.enum([
  "overdue_first",
  "return_date",
  "loan_date",
  "title",
  "author",
  "person",
]);

export type LoanSort = z.infer<typeof LoanSortSchema>;

export const LoansQuerySchema = z.object({
  filter: LoanFilterSchema.default("all"),
  ...paginationQueryFields({ pageSizeDefault: 10 }),
  person: z.string().trim().max(LOAN_PERSON_QUERY_MAX).optional(),
  search: z.string().trim().max(LOAN_SEARCH_MAX).optional(),
  sort: LoanSortSchema.default("overdue_first"),
  type: LoanTypeSchema.optional(),
});

export type LoansQuery = z.infer<typeof LoansQuerySchema>;

export const LoanBookPreviewSchema = z.object({
  cover: MediaViewSchema.nullable(),
  firstAuthorName: z.string(),
  id: z.string(),
  originalTitle: z.string().nullable(),
  ownershipStatus: OwnershipStatusSchema,
  publisher: z.object({ id: z.string(), name: z.string() }).nullable(),
  title: z.string(),
});

export type LoanBookPreview = z.infer<typeof LoanBookPreviewSchema>;

export const LoanListItemViewSchema = z.object({
  book: LoanBookPreviewSchema,
  contact: z.string().nullable(),
  createdAt: z.string(),
  expectedReturnDate: z.string().nullable(),
  id: z.string(),
  loanDate: z.string().nullable(),
  loanUiStatus: LoanUiStatusSchema,
  note: z.string().nullable(),
  personName: z.string(),
  remindBeforeDays: z.number().int().nullable(),
  remindToReturn: z.boolean(),
  type: LoanTypeSchema,
  updatedAt: z.string(),
});

export type LoanListItemView = z.infer<typeof LoanListItemViewSchema>;

export const PaginatedLoansSchema = createPaginatedSchema(LoanListItemViewSchema);

export const LOAN_STATS_WINDOWS = {
  longHeldDays: 30,
  returnSoonDays: 7,
} as const;

export const LoanPersonSummarySchema = z.object({
  bookCount: z.number().int().nonnegative(),
  covers: z.array(MediaViewSchema),
  personName: z.string(),
});

export type LoanPersonSummary = z.infer<typeof LoanPersonSummarySchema>;

export const LoanDirectionSummarySchema = z.object({
  earliestLoanDate: z.string().nullable(),
  longHeldCount: z.number().int().nonnegative(),
  longHeldLoans: z.array(LoanListItemViewSchema),
  nearestReturnDate: z.string().nullable(),
  noReminderWithDateCount: z.number().int().nonnegative(),
  noReturnDateCount: z.number().int().nonnegative(),
  noReturnDatePeopleCount: z.number().int().nonnegative(),
  oldestOverdueReturnDate: z.string().nullable(),
  overdueCount: z.number().int().nonnegative(),
  peopleCount: z.number().int().nonnegative(),
  returningSoonCount: z.number().int().nonnegative(),
  topPeople: z.array(LoanPersonSummarySchema),
  totalCount: z.number().int().nonnegative(),
  upcomingReturns: z.array(LoanListItemViewSchema),
});

export type LoanDirectionSummary = z.infer<typeof LoanDirectionSummarySchema>;

export const LoansSummaryViewSchema = z.object({
  borrowed: LoanDirectionSummarySchema,
  lent: LoanDirectionSummarySchema,
});

export type LoansSummaryView = z.infer<typeof LoansSummaryViewSchema>;
