# Loan return reminders — current state & proposal

> **Status: flag-only.** The "remind to return" (`Нагадати повернути`) option is fully
> captured, validated, persisted, read back, and filtered on — but **no reminder is ever
> delivered**. There is no scheduler, no reminder email, and nothing reads the user's
> `borrowedBookReminders` preference. Right now `remindToReturn` is a stored boolean whose
> only runtime effect is powering the `has_reminder` / `without_reminder` loan filter and a UI
> badge.

Audit date: 2026-07-08.

---

## 1. What exists today (capture → store → display → filter)

### Shared contract (`packages/shared/src`)

- `books.ts:425` / `books.ts:450` — `remindToReturn: z.boolean().optional()` on
  `CreateLoanInputSchema` / `UpdateLoanInputSchema`.
- `books.ts:431-439` / `books.ts:456-462` — `.refine(...)` enforcing that a reminder cannot be
  requested without an `expectedReturnDate` (`REMINDER_NEEDS_RETURN_DATE_MESSAGE`,
  `books.ts:391`).
- `loans.ts:69` — `remindToReturn: z.boolean()` on the loan view returned to the client.
- `loans.ts:18-19` — `has_reminder` / `without_reminder` loan filter enum values.

### Backend (`apps/api/src`)

- **Schema** — `prisma/schema.prisma:303`: `remindToReturn Boolean @default(false) @map("remind_to_return")` on `model BookLoan`. Paired with `expectedReturnDate` (`schema.prisma:301`).
- **Preference toggle (unconsumed)** — `prisma/schema.prisma:421`:
  `borrowedBookReminders Boolean @default(true)` on `UserSettings`. Editable via
  `modules/profile/application/settings.service.ts:53-54`, mapped in
  `modules/profile/domain/settings.mapper.ts:18`. **Nothing reads it to decide whether to send.**
- **Write path** — `modules/books/domain/loan-transition.ts:42` (create) and
  `loan-transition.ts:83` (edit) set `remindToReturn: input.remindToReturn ?? false`.
- **Read/map** — `modules/books/domain/book.mapper.ts:92` and
  `modules/loans/application/loans.service.ts:105` map the row into the ViewModel.
- **Filter / count** — `modules/loans/infrastructure/loans.repository.ts:119-132`
  (`has_reminder` → `where.remindToReturn = true`) and `loans.repository.ts:72`
  (summary count of active loans with a reminder).
- **What `without_reminder` means** — a loan that has an `expectedReturnDate` and
  `remindToReturn = false`. A loan with no return date is excluded, because the contract already
  forbids a reminder without a date, so every dateless loan would otherwise show up here and
  duplicate the `no_return_date` filter. The `noReminderWithDateCount` field of the loans summary
  counts exactly the same set, which is what the "without a reminder" row of the sidebar attention
  block reports.

### Frontend (`apps/web/src`)

- **Input** — `features/books/components/loan-dialog.tsx:292` — `remindToReturn` toggle field;
  Zod boolean at `loan-dialog.tsx:108`; client-side `refine` requiring a return date at
  `loan-dialog.tsx:116-117`; default `false` at `loan-dialog.tsx:151`; only sent when enabled at
  `loan-dialog.tsx:84`.
- **Display** — `features/books/components/ownership-block.tsx:381-384` — renders the
  `reminderOn` badge when `info.remindToReturn` is true.
- **Filter** — the loans page consumes the `has_reminder` / `without_reminder` filter and the
  summary reminder count.

### Tests that cover the current behavior

- `modules/books/api/book-loan.controller.test.ts` — 400 when `remindToReturn: true` without a
  return date (`:138`, `:543`); create/edit persist the flag (`:271`, `:478`).
- `modules/loans/api/loans.controller.test.ts` — `has_reminder` / `without_reminder` filters and
  the summary reminder count (`:216`, `:271`, `:530`).
- `modules/books/domain/loan-transition.test.ts` — flag defaults and transitions.

---

## 2. The gap — no delivery mechanism

The chain **scheduler → query due loans → compose email → respect user preference → send** does
not exist:

- **No scheduler.** `@nestjs/schedule` is a declared dependency but is **never imported** — there
  is no `ScheduleModule.forRoot()` and no `@Cron` / `@Interval` anywhere in `apps/api/src`.
  (Currently dead weight; `knip` would flag it.)
- **No reminder email.** `modules/mail/application/mail.service.ts` only exposes
  `sendVerificationEmail`, `sendWelcomeEmail`, `sendPasswordResetEmail`,
  `sendPasswordChangedEmail` — all called from `auth` only. There is no borrowed-book reminder.
- **No preference honoring.** `UserSettings.borrowedBookReminders` is written and read for the
  settings screen, but no send-path consults it.
- **No "reminder sent" state.** `BookLoan` has no `reminderSentAt` (or similar) column, so a naive
  daily job would re-send every day until the book is returned.

---

## 3. Proposal — deliver the reminder

This would be the **first real reason to wire up `@nestjs/schedule`** (per the repo rule: build
roadmap infra only when a real feature needs it). Suggested shape, following the canonical
"add an endpoint / job" workflow:

1. **Schema** — add a nullable `reminderSentAt DateTime? @db.Timestamptz @map("reminder_sent_at")`
   to `model BookLoan` so the job is idempotent (only send once per due window). Two-step
   migration flow (`db:migrate --name add_loan_reminder_sent_at` → review SQL → `db:migrate:deploy`).
2. **Repository** — `findLoansDueForReminder({ before })` in `loans.repository.ts`: active loans
   where `remindToReturn = true`, `expectedReturnDate <= today + N days`, `reminderSentAt IS NULL`,
   joined to the owner + `UserSettings.borrowedBookReminders = true`. Parameterized query only.
3. **Domain** — a pure `isLoanDueForReminder(loan, now, leadDays)` helper (unit-testable without
   Prisma), mirroring the existing `loan-transition.ts` domain style.
4. **Application** — a `LoanReminderService.dispatchDueReminders()` that: fetches due loans,
   composes the message, calls a new `MailService.sendLoanReturnReminderEmail(...)`, and stamps
   `reminderSentAt` inside a `TransactionRunner.run(...)` per loan (or batched). No `req`/`res`.
5. **Mail** — add `sendLoanReturnReminderEmail({ to, userName, bookTitle, personName, dueDate })`
   to `mail.service.ts`, consistent with the existing email methods.
6. **Scheduler** — `ScheduleModule.forRoot()` in `app.module.ts` + a thin
   `LoanReminderScheduler` with `@Cron(CronExpression.EVERY_DAY_AT_8AM)` that calls
   `dispatchDueReminders()`. Keep the cron class thin — logic lives in the service.
7. **Config** — reminder lead time (`LOAN_REMINDER_LEAD_DAYS`) and the cron schedule read once via
   Zod in `config/env.ts`, never `process.env` inline.
8. **Tests** — service unit test (mocked repo + mocked mail, asserts preference + idempotency),
   domain unit test for `isLoanDueForReminder`, and an integration test that seeds a due loan and
   asserts the mail stub was called once and `reminderSentAt` was set.

### Open questions to decide first

- **Lead time & cadence** — remind N days before `expectedReturnDate`, on the due date, and/or
  after it's overdue? One reminder or an escalating series?
- **Channel** — email only (infra exists) for now, or also in-app notification (no notification
  module exists yet — would be separate scaffolding)?
- **Timezone** — `expectedReturnDate` is a `@db.Date`; "due today" needs a per-user timezone or a
  fixed one to avoid off-by-one at midnight boundaries.
- **Idempotency window** — `reminderSentAt` as a single timestamp vs. a small
  `loan_reminders` log if multiple reminders per loan are wanted.

---

## Related

- [books](./books.md) — the loan/ownership block lives inside the books feature.
- Backend workflow: [../patterns.md](../patterns.md), [../../CLAUDE.md](../../CLAUDE.md) §5.
