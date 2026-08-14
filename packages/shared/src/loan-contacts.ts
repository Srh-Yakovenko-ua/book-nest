import { z } from "zod";

import { collapseSpaces } from "./common.js";
import { NoHtmlString } from "./internal.js";

const LOAN_CONTACT_NAME = {
  max: 100,
  min: 1,
} as const;

const LOAN_CONTACT_CONTACT_MAX = 100;

const LOAN_CONTACT_SEARCH_MAX = 100;

const LOAN_CONTACT_LIST_LIMIT = {
  default: 50,
  max: 200,
} as const;

const LoanContactNameSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.min(LOAN_CONTACT_NAME.min, "Enter the person's name").max(
      LOAN_CONTACT_NAME.max,
      "Name must be at most 100 characters long",
    ),
  );

const LoanContactContactSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(NoHtmlString.max(LOAN_CONTACT_CONTACT_MAX, "Contact must be at most 100 characters long"));

export const LoanContactViewSchema = z.object({
  archivedAt: z.string().nullable(),
  contact: z.string().nullable(),
  createdAt: z.string(),
  id: z.string(),
  loanCount: z.number().int().nonnegative(),
  name: z.string(),
  updatedAt: z.string(),
});

export type LoanContactView = z.infer<typeof LoanContactViewSchema>;

export const LoanContactsViewSchema = z.object({
  items: z.array(LoanContactViewSchema),
});

export type LoanContactsView = z.infer<typeof LoanContactsViewSchema>;

export const LoanContactsQuerySchema = z.object({
  includeArchived: z.stringbool().default(false),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(LOAN_CONTACT_LIST_LIMIT.max)
    .default(LOAN_CONTACT_LIST_LIMIT.default),
  search: z.string().trim().max(LOAN_CONTACT_SEARCH_MAX).optional(),
});

export type LoanContactsQuery = z.infer<typeof LoanContactsQuerySchema>;

export const CreateLoanContactInputSchema = z.strictObject({
  contact: LoanContactContactSchema.nullable().optional(),
  name: LoanContactNameSchema,
});

export type CreateLoanContactInput = z.infer<typeof CreateLoanContactInputSchema>;

const EMPTY_UPDATE_MESSAGE = "Provide a name or a contact to update";

export const UpdateLoanContactInputSchema = z
  .strictObject({
    contact: LoanContactContactSchema.nullable().optional(),
    name: LoanContactNameSchema.optional(),
  })
  .refine((input) => input.name !== undefined || input.contact !== undefined, {
    error: EMPTY_UPDATE_MESSAGE,
    path: ["name"],
  });

export type UpdateLoanContactInput = z.infer<typeof UpdateLoanContactInputSchema>;

export const LOAN_CONTACT_ERROR_CODES = {
  archivedName: "LOAN_CONTACT_ARCHIVED_NAME",
  duplicateName: "LOAN_CONTACT_DUPLICATE_NAME",
} as const;
