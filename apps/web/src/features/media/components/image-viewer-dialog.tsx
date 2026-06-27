"use client";

import Image from "next/image";
import { useLayoutEffect, useRef } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ImageViewerDialogProps = {
  alt: string;
  busy?: boolean;
  busyLabel?: string;
  caption?: string;
  deleteLabel?: string;
  downloadLabel?: string;
  downloadName?: string;
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
  busy = false,
  busyLabel,
  caption,
  deleteLabel,
  downloadLabel,
  downloadName,
  onDelete,
  onOpenChange,
  onReplace,
  open,
  replaceLabel,
  src,
  title,
}: ImageViewerDialogProps) {
  const openerRef = useRef<HTMLElement | null>(null);

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

  async function handleDownload() {
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(`Download failed with status ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName ?? "cover";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(src, "_blank", "noopener");
    }
  }

  const showFooter =
    onReplace !== undefined || onDelete !== undefined || downloadLabel !== undefined;

  return (
    <Dialog
      onOpenChange={(next) => {
        if (busy && !next) return;
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent
        aria-describedby={undefined}
        className="max-w-[90vw] gap-4 sm:max-w-2xl"
        onCloseAutoFocus={restoreFocus}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (busy) event.preventDefault();
        }}
        showCloseButton={!busy}
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
            className="object-contain"
            fill
            sizes="(min-width: 640px) 42rem, 90vw"
            src={src}
            unoptimized
          />
          {busy && (
            <div
              aria-busy
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-card/70 backdrop-blur-sm"
              role="status"
            >
              <UiIcon className="animate-spin text-muted-foreground" name="refresh" size={24} />
              {busyLabel === undefined ? null : (
                <p className="text-sm text-muted-foreground">{busyLabel}</p>
              )}
            </div>
          )}
        </div>
        {caption === undefined ? null : (
          <p className="text-center text-sm text-muted-foreground">{caption}</p>
        )}
        {showFooter && (
          <DialogFooter className="sm:justify-center">
            {onReplace === undefined ? null : (
              <Button disabled={busy} onClick={onReplace} type="button" variant="secondary">
                <UiIcon name="swap" size={16} />
                {replaceLabel}
              </Button>
            )}
            {downloadLabel === undefined ? null : (
              <Button
                disabled={busy}
                onClick={() => void handleDownload()}
                type="button"
                variant="secondary"
              >
                <UiIcon name="download" size={16} />
                {downloadLabel}
              </Button>
            )}
            {onDelete === undefined ? null : (
              <Button disabled={busy} onClick={onDelete} type="button" variant="ghost">
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
