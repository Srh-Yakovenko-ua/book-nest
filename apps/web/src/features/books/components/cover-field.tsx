"use client";

import type { MediaCrop } from "@app/shared";

import { MEDIA_MAX_UPLOAD_BYTES, MEDIA_MAX_UPLOAD_MB } from "@app/shared";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import Image from "next/image";
import { type RefObject, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Upload } from "@/components/ui/upload";
import {
  ACCEPT_ATTR,
  ACCEPTED_IMAGE_TYPES,
  COVER_ASPECT,
  cropImagePreview,
  isHeicCandidate,
  mediaDownloadName,
  normalizeImageFile,
} from "@/features/media";
import { cn } from "@/lib/utils";

import type { CoverState } from "../model/cover-state";

import { coverFullSrc, coverPreviewSrc } from "../model/cover-state";

const ImageCropDialog = dynamic(
  () => import("@/features/media/components/image-crop-dialog").then((m) => m.ImageCropDialog),
  { ssr: false },
);

const ImageViewerDialog = dynamic(
  () => import("@/features/media/components/image-viewer-dialog").then((m) => m.ImageViewerDialog),
  { ssr: false },
);

type CoverFieldProps = {
  disabled?: boolean;
  hadInitialCover: boolean;
  onChange: (next: CoverState) => void;
  state: CoverState;
};

export function CoverField({
  disabled = false,
  hadInitialCover,
  onChange,
  state,
}: CoverFieldProps) {
  const t = useTranslations("books.cover");
  const containerRef = useRef<HTMLDivElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [pendingViewerAction, setPendingViewerAction] = useState<"delete" | null>(null);
  const [coverLoaded, setCoverLoaded] = useState(false);

  const previewSrc = coverPreviewSrc(state);
  const fullSrc = coverFullSrc(state);
  const hasCover = state.kind === "selected" || state.kind === "existing";

  const viewerCaption =
    state.kind === "existing"
      ? [state.media.name, `${state.media.width} × ${state.media.height}`]
          .filter((part) => part !== null && part.length > 0)
          .join(" · ")
      : undefined;

  const downloadName =
    state.kind === "existing"
      ? mediaDownloadName({ contentType: state.media.contentType, name: state.media.name })
      : state.kind === "selected"
        ? state.file.name
        : undefined;

  function restoreFocus() {
    const opener = openerRef.current;
    if (opener !== null && opener.isConnected) {
      opener.focus();
      return;
    }
    containerRef.current?.querySelector<HTMLElement>("button:not([tabindex='-1'])")?.focus();
  }

  async function pickFile(file: File | undefined) {
    if (file === undefined) return;
    if (file.size > MEDIA_MAX_UPLOAD_BYTES) {
      toast.error(t("errors.size", { max: MEDIA_MAX_UPLOAD_MB }));
      return;
    }

    const converting = isHeicCandidate(file);
    if (converting) setIsConverting(true);

    let normalized: File;
    try {
      normalized = await normalizeImageFile(file);
    } catch {
      toast.error(t("errors.heic"));
      return;
    } finally {
      if (converting) setIsConverting(false);
    }

    if (!ACCEPTED_IMAGE_TYPES.includes(normalized.type)) {
      toast.error(t("errors.type"));
      return;
    }

    captureOpener(openerRef);
    setPendingFile(normalized);
  }

  async function handleCropped({ crop, file }: { crop: MediaCrop; file: File }) {
    setPendingFile(null);
    onChange({ crop, file, kind: "selected", previewUrl: await previewUrlFor({ crop, file }) });
  }

  function handleRemoveClick() {
    if (hadInitialCover) {
      captureOpener(openerRef);
      setRemoveConfirmOpen(true);
      return;
    }
    onChange({ kind: "empty" });
  }

  useEffect(() => {
    if (viewerOpen || pendingViewerAction === null) return;
    setPendingViewerAction(null);
    if (!hadInitialCover) {
      onChange({ kind: "empty" });
      return;
    }
    captureOpener(openerRef);
    setRemoveConfirmOpen(true);
  }, [hadInitialCover, onChange, pendingViewerAction, viewerOpen]);

  function confirmRemove() {
    onChange({ kind: "removed" });
    setRemoveConfirmOpen(false);
  }

  return (
    <div
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-card md:p-6"
      ref={containerRef}
    >
      <div className="flex items-center gap-2.5">
        <UiIcon className="text-primary" name="image" size={20} />
        <h2 className="font-heading text-lg text-ink">{t("title")}</h2>
      </div>

      <div
        className="motion-safe:animate-in motion-safe:duration-300 motion-safe:ease-out motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
        key={hasCover ? "cover-preview" : "cover-upload"}
      >
        {hasCover ? (
          <div className="flex gap-4">
            <button
              aria-label={t("viewer.open")}
              className="group relative aspect-[3/4] w-28 shrink-0 cursor-pointer overflow-hidden rounded-md bg-accent shadow-soft transition-shadow duration-300 ease-out outline-none hover:shadow-hover focus-visible:ring-3 focus-visible:ring-ring/50"
              onClick={() => setViewerOpen(true)}
              type="button"
            >
              {previewSrc === undefined ? null : (
                <Image
                  alt={t("previewAlt")}
                  className={cn(
                    "object-cover transition-opacity duration-500 ease-out",
                    coverLoaded ? "opacity-100" : "motion-safe:opacity-0",
                  )}
                  fill
                  onLoad={() => setCoverLoaded(true)}
                  sizes="112px"
                  src={previewSrc}
                  unoptimized
                />
              )}
            </button>
            <div className="flex flex-col gap-2 self-center">
              <Button
                disabled={disabled || isConverting}
                onClick={() => replaceInputRef.current?.click()}
                size="sm"
                type="button"
                variant="secondary"
              >
                <UiIcon name="swap" size={16} />
                {t("replace")}
              </Button>
              <Button
                disabled={disabled || isConverting}
                onClick={handleRemoveClick}
                size="sm"
                type="button"
                variant="ghost"
              >
                <UiIcon name="trash" size={16} />
                {t("remove")}
              </Button>
            </div>
          </div>
        ) : (
          <Upload
            accept={ACCEPT_ATTR}
            browseLabel={t("upload.browse")}
            disabled={disabled || isConverting}
            files={[]}
            hint={
              <>
                <p>{t("upload.formats", { max: MEDIA_MAX_UPLOAD_MB })}</p>
                <p>{t("upload.recommended")}</p>
              </>
            }
            media={
              <Image
                alt=""
                aria-hidden
                className="h-auto w-24 select-none"
                height={352}
                src="/illustrations/empty-library.png"
                width={352}
              />
            }
            onFilesChange={(files) => void pickFile(files[0])}
            title={t("upload.title")}
          />
        )}
      </div>

      {isConverting && (
        <p
          className="flex items-center gap-1.5 text-sm text-muted-foreground motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in"
          role="status"
        >
          <UiIcon className="animate-spin" name="refresh" size={16} />
          {t("converting")}
        </p>
      )}

      <input
        accept={ACCEPT_ATTR}
        aria-label={t("replace")}
        className="sr-only"
        onChange={(event) => {
          void pickFile(event.target.files?.[0]);
          event.target.value = "";
        }}
        ref={replaceInputRef}
        tabIndex={-1}
        type="file"
      />

      {viewerOpen && fullSrc !== undefined && (
        <ImageViewerDialog
          alt={t("previewAlt")}
          caption={viewerCaption}
          deleteLabel={t("remove")}
          downloadLabel={t("viewer.download")}
          downloadName={downloadName}
          onDelete={() => {
            setPendingViewerAction("delete");
            setViewerOpen(false);
          }}
          onOpenChange={setViewerOpen}
          onReplace={() => {
            setViewerOpen(false);
            replaceInputRef.current?.click();
          }}
          open
          replaceLabel={t("replace")}
          src={fullSrc}
          title={t("viewer.title")}
        />
      )}

      {pendingFile !== null && (
        <ImageCropDialog
          aspect={COVER_ASPECT}
          file={pendingFile}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreFocus();
          }}
          onCropped={(result) => void handleCropped(result)}
          onOpenChange={(open) => {
            if (!open) setPendingFile(null);
          }}
          open
        />
      )}

      <AlertDialog onOpenChange={setRemoveConfirmOpen} open={removeConfirmOpen}>
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreFocus();
          }}
          size="sm"
        >
          <AlertDialogHeader>
            <AlertDialogMedia>
              <UiIcon name="trash" size={24} />
            </AlertDialogMedia>
            <AlertDialogTitle>{t("removeConfirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("removeConfirm.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("removeConfirm.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} variant="destructive">
              {t("removeConfirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function captureOpener(ref: RefObject<HTMLElement | null>) {
  const active = document.activeElement;
  ref.current =
    active instanceof HTMLElement && active !== document.body && active.tabIndex !== -1
      ? active
      : null;
}

async function previewUrlFor({ crop, file }: { crop: MediaCrop; file: File }): Promise<string> {
  try {
    const preview = await cropImagePreview({ crop, file });
    return preview.url;
  } catch {
    return URL.createObjectURL(file);
  }
}
