import { BOOK_ORDER_LIMITS } from "@app/shared";
import { describe, expect, it, vi } from "vitest";

import type {
  DeliveryCandidateRow,
  ReminderRecipientRow,
} from "../infrastructure/reminder-candidates.repository.js";

import { fakeOf } from "../../../test/fake.js";
import { ReminderCandidatesRepository } from "../infrastructure/reminder-candidates.repository.js";
import { NotificationWriterService } from "./notification-writer.service.js";
import { RecipientReminderSweeper } from "./recipient-reminder.sweeper.js";

const KYIV = "Europe/Kyiv";
const TODAY = "2026-08-13";
const ARRIVING_TODAY = new Date("2026-08-13T00:00:00.000Z");
const CANDIDATE_PAGE_SIZE = 50;
const FAN_OUT_CAP = 1000;
const BOOKS_PER_SHIPMENT = 50;
const EXPECTED_ITEM_LIMIT = BOOK_ORDER_LIMITS.itemsMax;

const RECIPIENT = fakeOf<ReminderRecipientRow>({
  emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
  id: "user-1",
  settings: null,
});

function buildCandidatePage({
  booksPerShipment,
  page,
}: {
  booksPerShipment: number;
  page: number;
}): DeliveryCandidateRow[] {
  return Array.from({ length: CANDIDATE_PAGE_SIZE }, (_unused, shipmentIndex) =>
    fakeOf<DeliveryCandidateRow>({
      expectedDeliveryDate: ARRIVING_TODAY,
      id: `shipment-${page}-${shipmentIndex}`,
      items: Array.from({ length: booksPerShipment }, (_alsoUnused, bookIndex) => ({
        book: {
          id: `book-${page}-${shipmentIndex}-${bookIndex}`,
          title: `Book ${page}-${shipmentIndex}-${bookIndex}`,
        },
      })),
      order: { storeName: "Yakaboo" },
    }),
  );
}

function buildSweeper({ booksPerShipment }: { booksPerShipment: number }) {
  const write = vi.fn().mockResolvedValue({ emailDeliveryCreated: false });
  const requestedItemLimits: number[] = [];
  let page = 0;

  const candidatesRepository = fakeOf<ReminderCandidatesRepository>({
    findDeliveryCandidates: ({ itemsPerShipment }) => {
      requestedItemLimits.push(itemsPerShipment);
      page += 1;
      return Promise.resolve(buildCandidatePage({ booksPerShipment, page }));
    },
    findLoanCandidates: () => Promise.resolve([]),
  });

  return {
    requestedItemLimits,
    sweeper: new RecipientReminderSweeper(
      candidatesRepository,
      fakeOf<NotificationWriterService>({ write }),
    ),
    write,
  };
}

describe("RecipientReminderSweeper delivery fan-out", () => {
  it("stops writing once the per-sweep reminder budget is spent", async () => {
    const { sweeper, write } = buildSweeper({ booksPerShipment: BOOKS_PER_SHIPMENT });

    await sweeper.sweepRecipient({ recipient: RECIPIENT, timezone: KYIV, today: TODAY });

    expect(write).toHaveBeenCalledTimes(FAN_OUT_CAP);
  });

  it("asks the repository for a bounded slice of each shipment's books", async () => {
    const { requestedItemLimits, sweeper } = buildSweeper({ booksPerShipment: 1 });

    await sweeper.sweepRecipient({ recipient: RECIPIENT, timezone: KYIV, today: TODAY });

    expect(requestedItemLimits.every((limit) => limit === EXPECTED_ITEM_LIMIT)).toBe(true);
  });
});
