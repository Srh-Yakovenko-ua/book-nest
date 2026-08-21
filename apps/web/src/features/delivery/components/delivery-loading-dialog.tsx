"use client";

import { UiIcon } from "@/components/icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type DeliveryLoadingDialogProps = {
  className?: string;
  description: string;
  errorText: string;
  isError: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
};

export function DeliveryLoadingDialog({
  className,
  description,
  errorText,
  isError,
  onOpenChange,
  open,
  title,
}: DeliveryLoadingDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className={cn("sm:max-w-md", className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {isError ? (
          <p
            className="flex items-center gap-2 rounded-md bg-error-soft px-3 py-2 text-sm text-error"
            role="alert"
          >
            <UiIcon name="alert-triangle" size={16} />
            {errorText}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
