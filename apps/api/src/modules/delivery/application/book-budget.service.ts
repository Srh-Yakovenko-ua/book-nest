import type {
  BookBudgetCurrentMonth,
  BookBudgetOverview,
  BookBudgetStatus,
  BookBudgetVersion,
  Currency,
  Nullable,
  StopBookBudgetInput,
  UpsertBookBudgetInput,
} from "@app/shared";

import { BOOK_BUDGET_MESSAGE, CurrencySchema, toBudgetMonth } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { isAfter, isBefore, parseISO } from "date-fns";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { BookBudgetModel } from "../../../generated/prisma/models.js";
import type { BudgetMonthWindow } from "../domain/budget-forecast.js";
import type { ClassifiedOrder } from "../domain/statistics-scope.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { parseIsoDate, toIsoDate, toNullableIsoDate } from "../../../core/iso-date.js";
import { isUniqueConstraintError } from "../../../core/prisma-errors.js";
import { computeBudgetProgress, resolveBudgetMonthWindow } from "../domain/budget-forecast.js";
import { fromMinorUnits, toMinorUnits } from "../domain/money-minor-units.js";
import { classifyOrder } from "../domain/statistics-scope.js";
import { BookBudgetsRepository } from "../infrastructure/book-budgets.repository.js";
import { DeliveryStatisticsRepository } from "../infrastructure/delivery-statistics.repository.js";

const CURRENCY_ORDER: readonly Currency[] = CurrencySchema.options;

type BudgetVersions = {
  current: Nullable<BookBudgetModel>;
  scheduled: Nullable<BookBudgetModel>;
};

type CurrencySpend = {
  deliveryMinorUnits: number;
  spentMinorUnits: number;
};

@Injectable()
export class BookBudgetService {
  constructor(
    private readonly bookBudgetsRepository: BookBudgetsRepository,
    private readonly deliveryStatisticsRepository: DeliveryStatisticsRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async cancelScheduled({
    currency,
    userId,
  }: {
    currency: Currency;
    userId: string;
  }): Promise<BookBudgetOverview> {
    const now = new Date();
    const monthStart = parseIsoDate(resolveBudgetMonthWindow(now).month);

    await this.transactionRunner.run(async (tx) => {
      const scheduled = await this.bookBudgetsRepository.findFirstStartingAfter(
        { currency, month: monthStart, userId },
        tx,
      );
      if (scheduled === null) {
        throw new NotFoundError(BOOK_BUDGET_MESSAGE.noScheduledVersion);
      }

      const following = await this.bookBudgetsRepository.findFirstStartingAfter(
        { currency, month: scheduled.validFromMonth, userId },
        tx,
      );
      await this.bookBudgetsRepository.deleteById({ id: scheduled.id }, tx);
      await this.bookBudgetsRepository.reopenVersionEndingAt(
        {
          currency,
          endedAt: scheduled.validFromMonth,
          userId,
          validToMonth: following?.validFromMonth ?? null,
        },
        tx,
      );
    });

    return this.buildOverview({ now, userId });
  }

  overview({ userId }: { userId: string }): Promise<BookBudgetOverview> {
    return this.buildOverview({ now: new Date(), userId });
  }

  async stop({
    currency,
    input,
    userId,
  }: {
    currency: Currency;
    input: StopBookBudgetInput;
    userId: string;
  }): Promise<BookBudgetOverview> {
    const now = new Date();
    const stopFromMonth = this.requireUpcomingMonth({ month: input.effectiveFromMonth, now });

    await this.transactionRunner.run(async (tx) => {
      const covering = await this.bookBudgetsRepository.findEffectiveAt(
        { currency, month: stopFromMonth, userId },
        tx,
      );
      if (covering === null) {
        throw new NotFoundError(BOOK_BUDGET_MESSAGE.noBudgetToStop);
      }

      await this.bookBudgetsRepository.closeVersionCovering(
        { currency, userId, validToMonth: stopFromMonth },
        tx,
      );
      if (!isAfter(stopFromMonth, covering.validFromMonth)) {
        await this.bookBudgetsRepository.deleteById({ id: covering.id }, tx);
      }
    });

    return this.buildOverview({ now, userId });
  }

  async upsert({
    input,
    userId,
  }: {
    input: UpsertBookBudgetInput;
    userId: string;
  }): Promise<BookBudgetOverview> {
    const now = new Date();

    await this.writeVersion({
      currency: input.currency,
      monthlyAmount: input.monthlyAmount,
      userId,
      validFromMonth: this.requireUpcomingMonth({ month: input.effectiveFromMonth, now }),
    });

    return this.buildOverview({ now, userId });
  }

  private async buildOverview({
    now,
    userId,
  }: {
    now: Date;
    userId: string;
  }): Promise<BookBudgetOverview> {
    const monthWindow = resolveBudgetMonthWindow(now);
    const versions = await this.bookBudgetsRepository.findEffectiveOrLater({
      month: parseIsoDate(monthWindow.month),
      userId,
    });
    if (versions.length === 0) {
      return { budgets: [], month: monthWindow.month };
    }

    const spendByCurrency = await this.loadMonthSpend({ monthWindow, userId });

    return {
      budgets: toBudgetStatuses({ monthWindow, now, spendByCurrency, versions }),
      month: monthWindow.month,
    };
  }

  private async createVersion({
    currency,
    monthlyAmount,
    tx,
    userId,
    validFromMonth,
    validToMonth,
  }: {
    currency: Currency;
    monthlyAmount: number;
    tx: Prisma.TransactionClient;
    userId: string;
    validFromMonth: Date;
    validToMonth: Nullable<Date>;
  }): Promise<void> {
    try {
      await this.bookBudgetsRepository.create(
        { currency, monthlyAmount, userId, validFromMonth, validToMonth },
        tx,
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError(BOOK_BUDGET_MESSAGE.versionConflict);
      }
      throw error;
    }
  }

  private async loadMonthSpend({
    monthWindow,
    userId,
  }: {
    monthWindow: BudgetMonthWindow;
    userId: string;
  }): Promise<Map<Currency, CurrencySpend>> {
    const { records } = await this.deliveryStatisticsRepository.listOrderRecords({
      currency: undefined,
      from: parseIsoDate(monthWindow.month),
      status: undefined,
      store: undefined,
      to: parseIsoDate(monthWindow.lastDay),
      userId,
    });

    return sumMonthSpend(
      records.map((record) => classifyOrder({ includeCancelled: false, record })),
    );
  }

  private requireUpcomingMonth({ month, now }: { month: string; now: Date }): Date {
    const monthStart = toBudgetMonth(parseIsoDate(month));
    if (isBefore(parseISO(monthStart), parseISO(resolveBudgetMonthWindow(now).month))) {
      throw new BadRequestError(BOOK_BUDGET_MESSAGE.backdatedMonth);
    }
    return parseIsoDate(monthStart);
  }

  private async writeVersion({
    currency,
    monthlyAmount,
    userId,
    validFromMonth,
  }: {
    currency: Currency;
    monthlyAmount: number;
    userId: string;
    validFromMonth: Date;
  }): Promise<void> {
    await this.transactionRunner.run(async (tx) => {
      const existing = await this.bookBudgetsRepository.findByStartMonth(
        { currency, userId, validFromMonth },
        tx,
      );
      if (existing !== null) {
        await this.bookBudgetsRepository.updateAmountByStartMonth(
          { currency, monthlyAmount, userId, validFromMonth },
          tx,
        );
        return;
      }

      const next = await this.bookBudgetsRepository.findFirstStartingAfter(
        { currency, month: validFromMonth, userId },
        tx,
      );
      await this.bookBudgetsRepository.closeVersionCovering(
        { currency, userId, validToMonth: validFromMonth },
        tx,
      );
      await this.createVersion({
        currency,
        monthlyAmount,
        tx,
        userId,
        validFromMonth,
        validToMonth: next?.validFromMonth ?? null,
      });
    });
  }
}

function emptySpend(): CurrencySpend {
  return { deliveryMinorUnits: 0, spentMinorUnits: 0 };
}

function sumMonthSpend(orders: ClassifiedOrder[]): Map<Currency, CurrencySpend> {
  const spendByCurrency = new Map<Currency, CurrencySpend>();

  for (const order of orders) {
    if (!order.isIncluded) {
      continue;
    }
    const spend = spendByCurrency.get(order.currency) ?? emptySpend();
    spend.deliveryMinorUnits += toMinorUnits(order.record.deliveryPrice ?? 0);
    spend.spentMinorUnits += order.amount === null ? 0 : toMinorUnits(order.amount);
    spendByCurrency.set(order.currency, spend);
  }

  return spendByCurrency;
}

function toBudgetStatuses({
  monthWindow,
  now,
  spendByCurrency,
  versions,
}: {
  monthWindow: BudgetMonthWindow;
  now: Date;
  spendByCurrency: Map<Currency, CurrencySpend>;
  versions: BookBudgetModel[];
}): BookBudgetStatus[] {
  const monthStart = parseIsoDate(monthWindow.month);
  const byCurrency = new Map<Currency, BudgetVersions>();

  for (const version of versions) {
    const currency = CurrencySchema.parse(version.currency);
    const found = byCurrency.get(currency) ?? { current: null, scheduled: null };
    if (isAfter(version.validFromMonth, monthStart)) {
      found.scheduled ??= version;
    } else {
      found.current = version;
    }
    byCurrency.set(currency, found);
  }

  return CURRENCY_ORDER.flatMap((currency) => {
    const found = byCurrency.get(currency);
    if (found === undefined) {
      return [];
    }
    return [
      {
        currency,
        currentMonth:
          found.current === null
            ? null
            : toCurrentMonth({
                month: monthWindow.month,
                now,
                spend: spendByCurrency.get(currency) ?? emptySpend(),
                version: found.current,
              }),
        scheduled: found.scheduled === null ? null : toVersionView(found.scheduled),
      },
    ];
  });
}

function toCurrentMonth({
  month,
  now,
  spend,
  version,
}: {
  month: string;
  now: Date;
  spend: CurrencySpend;
  version: BookBudgetModel;
}): BookBudgetCurrentMonth {
  return {
    ...computeBudgetProgress({
      budget: version.monthlyAmount.toNumber(),
      deliverySpentToDate: fromMinorUnits(spend.deliveryMinorUnits),
      now,
      spentToDate: fromMinorUnits(spend.spentMinorUnits),
    }),
    month,
    validFromMonth: toIsoDate(version.validFromMonth),
    validToMonth: toNullableIsoDate(version.validToMonth),
  };
}

function toVersionView(version: BookBudgetModel): BookBudgetVersion {
  return {
    monthlyAmount: version.monthlyAmount.toNumber(),
    validFromMonth: toIsoDate(version.validFromMonth),
    validToMonth: toNullableIsoDate(version.validToMonth),
  };
}
