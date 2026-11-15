"use client";

import type { BookView } from "@app/shared";
import type { Dispatch } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";

import {
  type CreateBookOrderDraft,
  type CreateBookOrderDraftAction,
  type OrderBookDraft,
  type ShipmentDraft,
  shipmentLayout,
  unassignedBooks,
} from "../model/create-book-order-draft";
import { Field, FormSection } from "./create-order-form-parts";
import { CreateOrderShipmentSection } from "./create-order-shipment-section";

export function CreateOrderShippingSection({
  books,
  dispatch,
  shipments,
  shipping,
}: {
  books: OrderBookDraft[];
  dispatch: Dispatch<CreateBookOrderDraftAction>;
  shipments: ShipmentDraft[];
  shipping: CreateBookOrderDraft["shipping"];
}) {
  const t = useTranslations("delivery.createOrder");
  const assignedIds = new Set(shipments.flatMap((shipment) => shipment.bookIds));
  const layout = shipmentLayout({ books, shipments, shipping });
  const primaryShipment = shipments[0];

  function changeShipping(value: string) {
    if (value === "no") {
      dispatch({ type: "shippingDisabled" });
      return;
    }
    dispatch({ shipmentId: crypto.randomUUID(), type: "shippingEnabled" });
  }

  return (
    <FormSection description={t("shipments.description")} icon="truck" title={t("shipments.title")}>
      <div className="flex flex-col gap-4">
        <Field label={t("shipments.shippedQuestion")}>
          <Segmented
            block
            label={t("shipments.shippedQuestion")}
            onValueChange={changeShipping}
            options={[
              { label: t("shipments.shippedOptions.no"), value: "no" },
              { label: t("shipments.shippedOptions.yes"), value: "yes" },
            ]}
            value={shipping}
          />
        </Field>
        {shipping === "no" ? (
          <div
            className="flex items-start gap-2 rounded-md border border-info/30 bg-info-soft/60 px-3 py-2 text-xs text-info"
            role="status"
          >
            <UiIcon aria-hidden className="mt-px shrink-0" name="info" size={14} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="font-medium">{t("shipments.awaiting")}</p>
              <p>{t("shipments.awaitingHint")}</p>
            </div>
          </div>
        ) : null}
        {layout === "simple" && primaryShipment ? (
          <>
            <CreateOrderShipmentSection
              assignedIds={assignedIds}
              books={books.map(({ book }) => book)}
              index={0}
              onRemove={() => undefined}
              onToggleBook={() => undefined}
              onUpdate={(patch) =>
                dispatch({ patch, shipmentId: primaryShipment.id, type: "shipmentChanged" })
              }
              shipment={primaryShipment}
              showBooks={false}
            />
            <div
              className="flex items-start gap-2 rounded-md border border-info/30 bg-info-soft/60 px-3 py-2 text-xs text-info"
              role="status"
            >
              <UiIcon aria-hidden className="mt-px shrink-0" name="info" size={14} />
              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-0.5">
                  <p className="font-medium">{t("shipments.splitQuestion")}</p>
                  <p>{t("shipments.splitHint")}</p>
                </div>
                <Button
                  className="self-start sm:self-auto"
                  onClick={() =>
                    dispatch({
                      addedShipmentId: crypto.randomUUID(),
                      fallbackShipmentId: crypto.randomUUID(),
                      type: "shippingSplit",
                    })
                  }
                  size="sm"
                  variant="tonal"
                >
                  {t("shipments.split")}
                </Button>
              </div>
            </div>
          </>
        ) : null}
        {layout === "distribution" ? (
          <>
            <DistributionStatus
              books={unassignedBooks({ books, shipments }).map(({ book }) => book)}
              onMerge={
                shipments.length === 1 ? () => dispatch({ type: "shipmentsMerged" }) : undefined
              }
            />
            {shipments.map((shipment, index) => (
              <CreateOrderShipmentSection
                assignedIds={assignedIds}
                books={books.map(({ book }) => book)}
                canRemove={shipments.length > 1}
                index={index}
                key={shipment.id}
                onRemove={() =>
                  dispatch({ shipmentId: shipment.id, type: "shipmentRemovalRequested" })
                }
                onToggleBook={(bookId) =>
                  dispatch({ bookId, shipmentId: shipment.id, type: "shipmentBookToggled" })
                }
                onUpdate={(patch) =>
                  dispatch({ patch, shipmentId: shipment.id, type: "shipmentChanged" })
                }
                shipment={shipment}
                showBooks
              />
            ))}
            <Button
              className="self-start"
              disabled={books.length === 0}
              onClick={() => dispatch({ shipmentId: crypto.randomUUID(), type: "shipmentAdded" })}
              variant="outline"
            >
              <UiIcon name="plus" size={16} />
              {t("shipments.addAnother")}
            </Button>
          </>
        ) : null}
      </div>
    </FormSection>
  );
}

function DistributionStatus({ books, onMerge }: { books: BookView[]; onMerge?: () => void }) {
  const t = useTranslations("delivery.createOrder.shipments");
  const isComplete = books.length === 0;

  return (
    <div className="flex flex-col gap-2">
      <div
        className={
          isComplete
            ? "flex items-start gap-2 rounded-md border border-success/30 bg-success-soft/60 px-3 py-2 text-xs text-success"
            : "flex items-start gap-2 rounded-md border border-info/30 bg-info-soft/60 px-3 py-2 text-xs text-info"
        }
        role="status"
      >
        <UiIcon
          aria-hidden
          className="mt-px shrink-0"
          name={isComplete ? "check" : "info"}
          size={14}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="font-medium">{isComplete ? t("allDistributed") : t("unassignedTitle")}</p>
          <p>
            {isComplete ? t("allDistributedHint") : t("unassignedCount", { count: books.length })}
          </p>
          {isComplete ? null : <p>{t("distributionHint")}</p>}
        </div>
      </div>
      {onMerge === undefined ? null : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">{t("mergeHint")}</p>
          <Button className="self-start sm:self-auto" onClick={onMerge} size="sm" variant="tonal">
            {t("mergeAll")}
          </Button>
        </div>
      )}
    </div>
  );
}
