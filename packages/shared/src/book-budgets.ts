import { isBefore, isFirstDayOfMonth, parseISO } from "date-fns";
import { z } from "zod";

import { CurrencySchema } from "./book-enums.js";
import { CountSchema, isoDay } from "./internal.js";

const BUDGET_MONTH_ISO = {
  firstDaySuffix: "-01",
  monthPrefixLength: 7,
} as const;

export const BOOK_BUDGET_RULES = {
  forecastMinimumElapsedDays: 3,
  monthlyAmountMax: 99_999_999.99,
  monthlyAmountMin: 0.01,
} as const;

export const BOOK_BUDGET_MESSAGE = {
  amountTooLarge: `Monthly budget must be at most ${BOOK_BUDGET_RULES.monthlyAmountMax}`,
  amountTooSmall: "Monthly budget must be greater than zero",
  backdatedMonth: "A budget can start no earlier than the current month",
  firstDayOfMonth: "A budget month must be the first day of a month",
  noScheduledVersion: "There is no scheduled budget version to cancel",
  versionConflict: "This budget was changed somewhere else at the same time, please try again",
} as const;

export const BookBudgetMonthSchema = isoDay().refine(
  isFirstDayOfMonthIso,
  BOOK_BUDGET_MESSAGE.firstDayOfMonth,
);

export const UpsertBookBudgetInputSchema = z.object({
  currency: CurrencySchema,
  effectiveFromMonth: BookBudgetMonthSchema.refine(
    isNotBeforeCurrentMonth,
    BOOK_BUDGET_MESSAGE.backdatedMonth,
  ),
  monthlyAmount: z
    .number()
    .min(BOOK_BUDGET_RULES.monthlyAmountMin, BOOK_BUDGET_MESSAGE.amountTooSmall)
    .max(BOOK_BUDGET_RULES.monthlyAmountMax, BOOK_BUDGET_MESSAGE.amountTooLarge),
});

export type UpsertBookBudgetInput = z.infer<typeof UpsertBookBudgetInputSchema>;

export const BookBudgetVersionSchema = z.object({
  monthlyAmount: z.number(),
  validFromMonth: BookBudgetMonthSchema,
  validToMonth: BookBudgetMonthSchema.nullable().describe(
    "The first month this version no longer covers. Null while the version is open ended.",
  ),
});

export type BookBudgetVersion = z.infer<typeof BookBudgetVersionSchema>;

export const BookBudgetProgressSchema = z.object({
  budget: z.number(),
  daysInMonth: CountSchema,
  deliveryShareOfBudgetPercent: z
    .number()
    .nullable()
    .describe(
      "Delivery spend of the current month against the configured budget. Null when the budget cannot act as a denominator.",
    ),
  elapsedDays: CountSchema,
  forecast: z
    .number()
    .nullable()
    .describe(
      "Month-end spend projected from the pace so far. Null means insufficient data, which is every month before its third day.",
    ),
  projectedOverage: z.number().nullable(),
  remaining: z.number(),
  remainingSigned: z
    .number()
    .describe("Budget minus spend without a floor, so an overage reads as a negative number."),
  spentToDate: z.number(),
  usedPercent: z.number(),
});

export type BookBudgetProgress = z.infer<typeof BookBudgetProgressSchema>;

export const BookBudgetCurrentMonthSchema = BookBudgetProgressSchema.extend({
  month: BookBudgetMonthSchema,
  validFromMonth: BookBudgetMonthSchema,
});

export type BookBudgetCurrentMonth = z.infer<typeof BookBudgetCurrentMonthSchema>;

export const BookBudgetStatusSchema = z.object({
  currency: CurrencySchema,
  currentMonth: BookBudgetCurrentMonthSchema.nullable(),
  scheduled: BookBudgetVersionSchema.nullable(),
});

export type BookBudgetStatus = z.infer<typeof BookBudgetStatusSchema>;

export const BookBudgetOverviewSchema = z.object({
  budgets: z
    .array(BookBudgetStatusSchema)
    .describe("Only currencies the user has configured. An unconfigured currency is absent."),
  month: BookBudgetMonthSchema,
});

export type BookBudgetOverview = z.infer<typeof BookBudgetOverviewSchema>;

export function toBudgetMonth(date: Date): string {
  const monthPrefix = date.toISOString().slice(0, BUDGET_MONTH_ISO.monthPrefixLength);
  return `${monthPrefix}${BUDGET_MONTH_ISO.firstDaySuffix}`;
}

function isFirstDayOfMonthIso(value: string): boolean {
  return isFirstDayOfMonth(parseISO(value));
}

function isNotBeforeCurrentMonth(value: string): boolean {
  return !isBefore(parseISO(value), parseISO(toBudgetMonth(new Date())));
}
