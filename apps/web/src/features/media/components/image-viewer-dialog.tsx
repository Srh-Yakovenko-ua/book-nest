"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ImageViewerDialogProps = {
  alt: string;
  caption?: string;
  deleteLabel?: string;
  onDelete?: () => void;
  onOpenChange: (open: boolean) => void;
  onReplace?: () => void;
  open: boolean;
  replaceLabel?: string;
  src: string;
  title?: string;
};

export function ImageViewerDialog({
  alt,
  caption,
  deleteLabel,
  onDelete,
  onOpenChange,
  onReplace,
  open,
  replaceLabel,
  src,
  title,
}: ImageViewerDialogProps) {
  const openerRef = useRef<HTMLElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  useLayoutEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    openerRef.current = active instanceof HTMLElement ? active : null;
  }, [open]);

  function restoreFocus(event: Event) {
    const opener = openerRef.current;
    if (opener !== null && opener.isConnected) {
      event.preventDefault();
      opener.focus();
    }
  }

  const showFooter = onReplace !== undefined || onDelete !== undefined;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-[90vw] gap-4 sm:max-w-2xl"
        onCloseAutoFocus={restoreFocus}
      >
        {title === undefined ? (
          <DialogTitle className="sr-only">{alt}</DialogTitle>
        ) : (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        )}
        <div className="relative h-[70vh] w-full overflow-hidden rounded-lg bg-muted">
          <Image
            alt={alt}
            className={cn(
              "object-contain transition-opacity duration-500 ease-out",
              loaded ? "opacity-100" : "motion-safe:opacity-0",
            )}
            fill
            onLoad={() => setLoaded(true)}
            sizes="(min-width: 640px) 42rem, 90vw"
            src={src}
            unoptimized
          />
        </div>
        {caption === undefined ? null : (
          <p className="text-center text-sm text-muted-foreground">{caption}</p>
        )}
        {showFooter && (
          <DialogFooter className="sm:justify-center">
            {onReplace === undefined ? null : (
              <Button onClick={onReplace} type="button" variant="secondary">
                <UiIcon name="swap" size={16} />
                {replaceLabel}
              </Button>
            )}
            {onDelete === undefined ? null : (
              <Button onClick={onDelete} type="button" variant="ghost">
                <UiIcon name="trash" size={16} />
                {deleteLabel}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
