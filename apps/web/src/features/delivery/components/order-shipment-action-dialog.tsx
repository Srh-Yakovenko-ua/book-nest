"use client";

import type { FormEvent } from "react";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/http-client";

import type { DeliveryOrderCardModel, DeliveryShipmentGroupModel } from "../model/order-card-model";

import {
  useCancelShipment,
  useCreateShipment,
  useUpdateOrder,
  useUpdateShipment,
} from "../api/use-order-shipment-actions";

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
    return <EditOrderDialog action={action} onOpenChange={onOpenChange} />;
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
  const mutation = useCreateShipment(action.order.id);
  const itemIds = action.order.shipments
    .filter(({ id }) => id === null)
    .flatMap(({ books }) => books.map(({ id }) => id));
  const [trackingNumber, setTrackingNumber] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate(
      { itemIds, status: "ordered", trackingNumber: trackingNumber || undefined },
      callbacks(t("shipmentAdded"), t("error"), onOpenChange),
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

function callbacks(success: string, errorText: string, onOpenChange: (open: boolean) => void) {
  return {
    onError: (error: Error) => toast.error(error instanceof ApiError ? error.message : errorText),
    onSuccess: () => {
      toast.success(success);
      onOpenChange(false);
    },
  };
}

function CancelShipmentDialog({
  action,
  onOpenChange,
}: {
  action: Extract<OrderShipmentAction, { kind: "cancel-shipment" }>;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("delivery.manage");
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
              callbacks(t("shipmentCancelled"), t("error"), onOpenChange),
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

function EditOrderDialog({
  action,
  onOpenChange,
}: {
  action: Extract<OrderShipmentAction, { kind: "edit-order" }>;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("delivery.manage");
  const mutation = useUpdateOrder(action.order.id);
  const [storeName, setStoreName] = useState(action.order.storeName);
  const [orderNumber, setOrderNumber] = useState(action.order.orderNumber ?? "");
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate(
      { orderNumber: orderNumber || null, storeName },
      callbacks(t("orderUpdated"), t("error"), onOpenChange),
    );
  }
  return (
    <Frame
      description={t("editOrderDescription")}
      onOpenChange={onOpenChange}
      title={t("editOrder")}
    >
      <form className="space-y-4" onSubmit={submit}>
        <Field label={t("store")} onChange={setStoreName} required value={storeName} />
        <Field label={t("orderNumber")} onChange={setOrderNumber} value={orderNumber} />
        <Footer loading={mutation.isPending} t={t} />
      </form>
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
  const shipmentId = action.shipment.id ?? "";
  const mutation = useUpdateShipment(shipmentId);
  const [trackingNumber, setTrackingNumber] = useState(action.shipment.trackingNumber ?? "");
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate(
      { trackingNumber: trackingNumber || null },
      callbacks(t("shipmentUpdated"), t("error"), onOpenChange),
    );
  }
  return (
    <Frame
      description={t("editShipmentDescription")}
      onOpenChange={onOpenChange}
      title={t("editShipment")}
    >
      <form className="space-y-4" onSubmit={submit}>
        <Field label={t("trackingNumber")} onChange={setTrackingNumber} value={trackingNumber} />
        <Footer loading={mutation.isPending} t={t} />
      </form>
    </Frame>
  );
}

function Field({
  label,
  onChange,
  value,
  ...props
}: {
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <Input onChange={(event) => onChange(event.target.value)} value={value} {...props} />
    </label>
  );
}
function Footer({
  loading,
  t,
}: {
  loading: boolean;
  t: ReturnType<typeof useTranslations<"delivery.manage">>;
}) {
  return (
    <DialogFooter>
      <Button loading={loading} type="submit">
        {t("save")}
      </Button>
    </DialogFooter>
  );
}
function Frame({
  children,
  description,
  onOpenChange,
  title,
}: {
  children: React.ReactNode;
  description: string;
  onOpenChange: (open: boolean) => void;
  title: string;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
