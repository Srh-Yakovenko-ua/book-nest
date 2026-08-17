"use client";

import type { ActiveShipmentStatus } from "@app/shared";
import type { FormEvent } from "react";

import { isActiveShipmentStatus, SHIPMENT_ACTIVE_STATUSES } from "@app/shared";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BookDateField } from "@/features/books/components/book-date-field";
import { DeliveryServiceAutocomplete } from "@/features/books/components/delivery-service-autocomplete";
import { useDeliveryErrorText } from "@/features/books/hooks/use-delivery-error-text";

import type { DeliveryOrderCardModel, DeliveryShipmentGroupModel } from "../model/order-card-model";

import {
  useCancelShipment,
  useCreateShipment,
  useUpdateShipment,
} from "../api/use-order-shipment-actions";
import { EditOrderDialog } from "./edit-order-dialog";
import {
  Field,
  Footer,
  Frame,
  Labeled,
  mutationCallbacks,
  NOTE_MAX_LENGTH,
} from "./order-dialog-parts";

export type OrderShipmentAction =
  | { kind: "add-shipment"; order: DeliveryOrderCardModel }
  | { kind: "cancel-shipment"; shipment: DeliveryShipmentGroupModel }
  | { kind: "edit-order"; order: DeliveryOrderCardModel }
  | { kind: "edit-shipment"; shipment: DeliveryShipmentGroupModel };

export function OrderShipmentActionDialog({
  action,
  onOpenChange,
}: {
  action: OrderShipmentAction;
  onOpenChange: (open: boolean) => void;
}) {
  if (action.kind === "edit-order")
    return <EditOrderDialog onOpenChange={onOpenChange} order={action.order} />;
  if (action.kind === "add-shipment")
    return <AddShipmentDialog action={action} onOpenChange={onOpenChange} />;
  if (action.kind === "edit-shipment")
    return <EditShipmentDialog action={action} onOpenChange={onOpenChange} />;
  return <CancelShipmentDialog action={action} onOpenChange={onOpenChange} />;
}

function AddShipmentDialog({
  action,
  onOpenChange,
}: {
  action: Extract<OrderShipmentAction, { kind: "add-shipment" }>;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("delivery.manage");
  const deliveryErrorText = useDeliveryErrorText();
  const mutation = useCreateShipment(action.order.id);
  const itemIds = action.order.shipments
    .filter(({ id }) => id === null)
    .flatMap(({ books }) => books.map(({ id }) => id));
  const [trackingNumber, setTrackingNumber] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate(
      { itemIds, status: "ordered", trackingNumber: trackingNumber || undefined },
      mutationCallbacks(t("shipmentAdded"), deliveryErrorText, onOpenChange),
    );
  }
  return (
    <Frame
      description={t("addShipmentDescription")}
      onOpenChange={onOpenChange}
      title={t("addShipment")}
    >
      <form className="space-y-4" onSubmit={submit}>
        <Field label={t("trackingNumber")} onChange={setTrackingNumber} value={trackingNumber} />
        <Footer loading={mutation.isPending} t={t} />
      </form>
    </Frame>
  );
}

function CancelShipmentDialog({
  action,
  onOpenChange,
}: {
  action: Extract<OrderShipmentAction, { kind: "cancel-shipment" }>;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("delivery.manage");
  const deliveryErrorText = useDeliveryErrorText();
  const mutation = useCancelShipment(action.shipment.id ?? "");
  return (
    <Frame
      description={t("cancelShipmentDescription")}
      onOpenChange={onOpenChange}
      title={t("cancelShipment")}
    >
      <DialogFooter>
        <Button onClick={() => onOpenChange(false)} variant="outline">
          {t("close")}
        </Button>
        <Button
          loading={mutation.isPending}
          onClick={() =>
            mutation.mutate(
              { keepAsWantToBuy: true },
              mutationCallbacks(t("shipmentCancelled"), deliveryErrorText, onOpenChange),
            )
          }
          variant="destructive"
        >
          {t("confirmCancel")}
        </Button>
      </DialogFooter>
    </Frame>
  );
}

function EditShipmentDialog({
  action,
  onOpenChange,
}: {
  action: Extract<OrderShipmentAction, { kind: "edit-shipment" }>;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("delivery.manage");
  const tStatus = useTranslations("books.deliveryStatus.labels");
  const deliveryErrorText = useDeliveryErrorText();
  const shipmentId = action.shipment.id ?? "";
  const mutation = useUpdateShipment(shipmentId);
  const [deliveryService, setDeliveryService] = useState(action.shipment.serviceName ?? "");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(
    action.shipment.expectedDate ?? "",
  );
  const [status, setStatus] = useState<ActiveShipmentStatus>(
    action.shipment.status !== null && isActiveShipmentStatus(action.shipment.status)
      ? action.shipment.status
      : "ordered",
  );
  const [trackingNumber, setTrackingNumber] = useState(action.shipment.trackingNumber ?? "");
  const [trackingUrl, setTrackingUrl] = useState(action.shipment.trackingUrl ?? "");
  const [note, setNote] = useState(action.shipment.note ?? "");

  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate(
      {
        deliveryService: deliveryService.trim() || null,
        expectedDeliveryDate: expectedDeliveryDate || null,
        note: note.trim() || null,
        status,
        trackingNumber: trackingNumber.trim() || null,
        trackingUrl: trackingUrl.trim() || null,
      },
      mutationCallbacks(t("shipmentUpdated"), deliveryErrorText, onOpenChange),
    );
  }

  return (
    <Frame
      description={t("editShipmentDescription")}
      onOpenChange={onOpenChange}
      title={t("editShipment")}
    >
      <form className="space-y-4" noValidate onSubmit={submit}>
        <Labeled htmlFor="edit-shipment-service" label={t("deliveryService")}>
          <DeliveryServiceAutocomplete
            id="edit-shipment-service"
            invalid={false}
            label={t("deliveryService")}
            onChange={setDeliveryService}
            placeholder={t("deliveryServicePlaceholder")}
            value={deliveryService}
          />
        </Labeled>
        <Labeled htmlFor="edit-shipment-expected-date" label={t("expectedDate")}>
          <BookDateField
            allowFuture
            ariaLabel={t("expectedDate")}
            id="edit-shipment-expected-date"
            onChange={(next) => setExpectedDeliveryDate(next ?? "")}
            value={expectedDeliveryDate}
          />
        </Labeled>
        <Labeled htmlFor="edit-shipment-status" label={t("status")}>
          <Select
            onValueChange={(value) => setStatus(value as ActiveShipmentStatus)}
            value={status}
          >
            <SelectTrigger className="w-full" id="edit-shipment-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHIPMENT_ACTIVE_STATUSES.map((option) => (
                <SelectItem key={option} value={option}>
                  {tStatus(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Labeled>
        <Field label={t("trackingNumber")} onChange={setTrackingNumber} value={trackingNumber} />
        <Field label={t("trackingUrl")} onChange={setTrackingUrl} value={trackingUrl} />
        <Labeled htmlFor="edit-shipment-note" label={t("note")}>
          <Textarea
            id="edit-shipment-note"
            maxLength={NOTE_MAX_LENGTH}
            onChange={(event) => setNote(event.target.value)}
            value={note}
          />
        </Labeled>
        <Footer loading={mutation.isPending} t={t} />
      </form>
    </Frame>
  );
}
