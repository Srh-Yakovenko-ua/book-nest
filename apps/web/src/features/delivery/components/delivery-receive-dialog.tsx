"use client";

import { useTranslations } from "next-intl";
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
import { ApiError } from "@/lib/http-client";

import { useBulkReceive } from "../api/use-bulk-receive";

type DeliveryReceiveDialogProps = {
  bookIds: string[];
  onOpenChange: (open: boolean) => void;
  onReceived?: () => void;
  open: boolean;
};

export function DeliveryReceiveDialog({
  bookIds,
  onOpenChange,
  onReceived,
  open,
}: DeliveryReceiveDialogProps) {
  const t = useTranslations("delivery.receiveDialog");
  const tToast = useTranslations("delivery.toast");
  const tActions = useTranslations("books.actions");
  const bulkReceive = useBulkReceive();

  const count = bookIds.length;

  function onConfirm() {
    bulkReceive.mutate(bookIds, {
      onError: (error) => toast.error(error instanceof ApiError ? error.message : tToast("error")),
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

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description", { count })}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} type="button" variant="secondary">
            {tActions("cancel")}
          </Button>
          <Button
            disabled={bulkReceive.isPending}
            loading={bulkReceive.isPending}
            onClick={onConfirm}
            type="button"
          >
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
