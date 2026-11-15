"use client";

import type { BookView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { DeliveryServiceAutocomplete } from "@/features/books/components/delivery-service-autocomplete";

import type { ShipmentDraft } from "../model/create-book-order-draft";

import { DateField, Field, TextField } from "./create-order-form-parts";

export function CreateOrderShipmentSection({
  assignedIds,
  books,
  canRemove,
  index,
  onRemove,
  onToggleBook,
  onUpdate,
  shipment,
  showBooks,
}: {
  assignedIds: ReadonlySet<string>;
  books: BookView[];
  canRemove?: boolean;
  index: number;
  onRemove: () => void;
  onToggleBook: (bookId: string) => void;
  onUpdate: (patch: Partial<ShipmentDraft>) => void;
  shipment: ShipmentDraft;
  showBooks: boolean;
}) {
  const t = useTranslations("delivery.createOrder.shipments");
  const [additionalOpen, setAdditionalOpen] = useState(false);
  const [bookSelectionOpen, setBookSelectionOpen] = useState(false);
  const shipmentBooks = books.filter((book) => shipment.bookIds.includes(book.id));
  const selectableBooks = books.filter(
    (book) => shipment.bookIds.includes(book.id) || !assignedIds.has(book.id),
  );
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-secondary/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-medium text-ink">
          {showBooks ? t("shipment", { number: index + 1 }) : t("singleShipment")}
        </h4>
        {showBooks ? (
          <Badge className="mr-auto" variant="secondary">
            {t("bookCount", { count: shipmentBooks.length })}
          </Badge>
        ) : null}
        {showBooks && canRemove === true ? (
          <Button
            aria-label={t("remove", { number: index + 1 })}
            onClick={onRemove}
            size="icon-sm"
            variant="ghost"
          >
            <UiIcon name="trash" size={16} />
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("service")} optional>
          <DeliveryServiceAutocomplete
            id={`shipment-service-${shipment.id}`}
            invalid={false}
            label={t("service")}
            onChange={(deliveryService) => onUpdate({ deliveryService })}
            placeholder={t("servicePlaceholder")}
            value={shipment.deliveryService}
          />
        </Field>
        <TextField
          label={t("trackingNumber")}
          onChange={(trackingNumber) => onUpdate({ trackingNumber })}
          optional
          value={shipment.trackingNumber}
        />
        <DateField
          allowFuture
          disablePast
          id={`shipment-expected-date-${shipment.id}`}
          label={t("expectedDate")}
          onChange={(expectedDeliveryDate) => onUpdate({ expectedDeliveryDate })}
          optional
          value={shipment.expectedDeliveryDate}
        />
        <Collapsible
          className="flex flex-col gap-4 sm:col-span-2"
          onOpenChange={setAdditionalOpen}
          open={additionalOpen}
        >
          <CollapsibleTrigger className="group flex cursor-pointer items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-ink transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
            {t("additional")}
            <UiIcon
              className="text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
              name="chevron-down"
              size={16}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-4">
            <DateField
              allowFuture
              disablePast
              id={`shipment-pickup-until-${shipment.id}`}
              label={t("pickupUntil")}
              onChange={(pickupUntil) => onUpdate({ pickupUntil })}
              optional
              value={shipment.pickupUntil}
            />
            <TextField
              label={t("trackingUrl")}
              onChange={(trackingUrl) => onUpdate({ trackingUrl })}
              optional
              type="url"
              value={shipment.trackingUrl}
            />
            <Field label={t("note")} optional>
              <Textarea
                onChange={(event) => onUpdate({ note: event.target.value })}
                value={shipment.note}
              />
            </Field>
          </CollapsibleContent>
        </Collapsible>
      </div>
      {showBooks ? (
        bookSelectionOpen ? (
          <fieldset className="flex flex-col gap-3 border-t border-border pt-4">
            <legend className="px-1 text-sm font-medium text-ink">{t("selectBooks")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {selectableBooks.map((book) => (
                <label className="flex cursor-pointer items-center gap-2" key={book.id}>
                  <Checkbox
                    checked={shipment.bookIds.includes(book.id)}
                    onCheckedChange={() => onToggleBook(book.id)}
                  />
                  <span className="text-sm">{book.title}</span>
                </label>
              ))}
            </div>
            <Button className="self-end" onClick={() => setBookSelectionOpen(false)} size="sm">
              {t("doneSelectingBooks")}
            </Button>
          </fieldset>
        ) : shipmentBooks.length > 0 ? (
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <p className="text-sm font-medium text-ink">
              {t("inShipment", { count: shipmentBooks.length })}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {shipmentBooks.map((book) => (
                <Badge key={book.id} variant="secondary">
                  <UiIcon name="book" size={12} />
                  {book.title}
                </Badge>
              ))}
            </div>
            <Button
              className="self-end"
              onClick={() => setBookSelectionOpen(true)}
              size="sm"
              variant="outline"
            >
              <UiIcon name="edit" size={14} />
              {t("editBooks")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium text-ink">{t("emptyShipment")}</p>
              <p className="text-xs text-muted-foreground">{t("emptyShipmentHint")}</p>
            </div>
            <Button
              className="self-end"
              disabled={selectableBooks.length === 0}
              onClick={() => setBookSelectionOpen(true)}
              size="sm"
              variant="outline"
            >
              <UiIcon name="plus" size={14} />
              {t("addBooksToShipment")}
            </Button>
          </div>
        )
      ) : null}
    </section>
  );
}
