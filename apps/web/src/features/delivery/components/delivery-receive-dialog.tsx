"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";
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
import { useDeliveryErrorText } from "@/features/books/hooks/use-delivery-error-text";

import { useBulkReceive } from "../api/use-bulk-receive";
import { useReceiveShipment } from "../api/use-order-shipment-actions";

export type DeliveryReceiveTarget =
  | { bookCount: number; kind: "shipment"; shipmentId: string }
  | { bookIds: string[]; kind: "books" };

type DeliveryReceiveDialogProps = {
  onOpenChange: (open: boolean) => void;
  onReceived?: () => void;
  open: boolean;
  target: DeliveryReceiveTarget;
};

export function DeliveryReceiveDialog({
  onOpenChange,
  onReceived,
  open,
  target,
}: DeliveryReceiveDialogProps) {
  const t = useTranslations("delivery.receiveDialog");
  const tToast = useTranslations("delivery.toast");
  const deliveryErrorText = useDeliveryErrorText();
  const tActions = useTranslations("books.actions");
  const bulkReceive = useBulkReceive();
  const receiveShipment = useReceiveShipment();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const count = target.kind === "books" ? target.bookIds.length : target.bookCount;

  function onConfirm() {
    if (target.kind === "shipment") {
      receiveShipment.mutate(target.shipmentId, {
        onError: (error) => toast.error(deliveryErrorText(error)),
        onSuccess: () => {
          toast.success(tToast("receivedBulk", { count }));
          onReceived?.();
          onOpenChange(false);
        },
      });
      return;
    }

    bulkReceive.mutate(target.bookIds, {
      onError: (error) => toast.error(deliveryErrorText(error)),
      onSuccess: (result) => {
        const received = result.receivedBookIds.length;
        const skipped = result.skipped.length;
        if (skipped > 0) {
          toast.warning(tToast("receivedPartial", { received, skipped }));
        } else {
          toast.success(tToast("receivedBulk", { count: received }));
        }
        onReceived?.();
        onOpenChange(false);
      },
    });
  }

  const isPending = bulkReceive.isPending || receiveShipment.isPending;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          confirmButtonRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description", { count })}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} type="button" variant="secondary">
            {tActions("cancel")}
          </Button>
          <Button
            disabled={isPending}
            loading={isPending}
            onClick={onConfirm}
            ref={confirmButtonRef}
            type="button"
          >
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
