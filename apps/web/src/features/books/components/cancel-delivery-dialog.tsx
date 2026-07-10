"use client";

import type { BookView, DeliveryView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/http-client";

import { useCancelDelivery } from "../api/use-delivery";

const CANCEL_REASON_MAX = 500;

type CancelDeliveryDialogProps = {
  book: BookView;
  delivery: DeliveryView;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function CancelDeliveryDialog({
  book,
  delivery,
  onOpenChange,
  open,
}: CancelDeliveryDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <CancelForm book={book} delivery={delivery} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CancelForm({
  book,
  delivery,
  onDone,
}: {
  book: BookView;
  delivery: DeliveryView;
  onDone: () => void;
}) {
  const t = useTranslations("books.details.delivery.cancelDialog");
  const tErrors = useTranslations("books.details.delivery.errors");
  const tActions = useTranslations("books.actions");
  const cancelDelivery = useCancelDelivery();
  const [keepAsWantToBuy, setKeepAsWantToBuy] = useState(true);
  const [cancelReason, setCancelReason] = useState("");
  const [serverError, setServerError] = useState<null | string>(null);

  function onConfirm() {
    setServerError(null);
    const trimmedReason = cancelReason.trim();
    cancelDelivery.mutate(
      {
        deliveryId: delivery.id,
        id: book.id,
        payload: {
          cancelReason: trimmedReason.length > 0 ? trimmedReason : undefined,
          keepAsWantToBuy,
        },
      },
      {
        onError: (error) =>
          setServerError(error instanceof ApiError ? error.message : tErrors("generic")),
        onSuccess: onDone,
      },
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>

      <label className="flex cursor-pointer items-center gap-3">
        <Checkbox
          checked={keepAsWantToBuy}
          onCheckedChange={(next) => setKeepAsWantToBuy(next === true)}
        />
        <span className="text-sm text-foreground">{t("keepAsWantToBuy")}</span>
      </label>

      <div className="flex flex-col gap-2">
        <Label htmlFor="cancel-reason">{t("reasonLabel")}</Label>
        <Textarea
          aria-describedby="cancel-reason-counter"
          id="cancel-reason"
          maxLength={CANCEL_REASON_MAX}
          onChange={(event) => setCancelReason(event.target.value)}
          placeholder={t("reasonPlaceholder")}
          value={cancelReason}
        />
        <span
          className="ml-auto text-xs text-muted-foreground tabular-nums"
          id="cancel-reason-counter"
        >
          {cancelReason.length}/{CANCEL_REASON_MAX}
        </span>
      </div>

      {serverError === null ? null : (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {serverError}
        </p>
      )}

      <DialogFooter>
        <Button onClick={onDone} type="button" variant="secondary">
          {tActions("cancel")}
        </Button>
        <Button
          disabled={cancelDelivery.isPending}
          loading={cancelDelivery.isPending}
          onClick={onConfirm}
          type="button"
          variant="destructive"
        >
          {t("confirm")}
        </Button>
      </DialogFooter>
    </div>
  );
}
