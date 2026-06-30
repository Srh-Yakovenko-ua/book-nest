"use client";

import type { MediaCrop, MediaView } from "@app/shared";

import { MEDIA_MAX_UPLOAD_BYTES, MEDIA_MAX_UPLOAD_MB } from "@app/shared";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { toast } from "sonner";

import {
  ACCEPT_ATTR,
  ACCEPTED_IMAGE_TYPES,
  COVER_ASPECT,
  ImageViewerDialog,
  isHeicCandidate,
  mediaDownloadName,
  normalizeImageFile,
  useUploadMedia,
} from "@/features/media";

import { useUpdateBook } from "../api/use-update-book";

const ImageCropDialog = dynamic(
  () => import("@/features/media/components/image-crop-dialog").then((m) => m.ImageCropDialog),
  { ssr: false },
);

type LibraryCoverViewerProps = {
  bookId: string;
  media: MediaView;
  onClose: () => void;
  title: string;
};

export function LibraryCoverViewer({ bookId, media, onClose, title }: LibraryCoverViewerProps) {
  const t = useTranslations("books.cover");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const uploadMedia = useUploadMedia();
  const updateBook = useUpdateBook(bookId);

  const isBusy = uploadMedia.isPending || updateBook.isPending || isConverting;

  const caption = [media.name, `${media.width} × ${media.height}`]
    .filter((part) => part !== null && part.length > 0)
    .join(" · ");

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

    setPendingFile(normalized);
  }

  async function handleCropped({ crop, file }: { crop: MediaCrop; file: File }) {
    try {
      const uploaded = await uploadMedia.mutateAsync({ crop, file });
      await updateBook.mutateAsync({ coverMediaId: uploaded.id });
      toast.success(t("replaceSuccess"));
      setPendingFile(null);
      onClose();
    } catch {
      toast.error(t("errors.upload"));
      setPendingFile(null);
    }
  }

  return (
    <>
      <input
        accept={ACCEPT_ATTR}
        aria-label={t("replace")}
        className="sr-only"
        onChange={(event) => {
          void pickFile(event.target.files?.[0]);
          event.target.value = "";
        }}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />

      <ImageViewerDialog
        alt={title}
        busy={isBusy}
        busyLabel={t("replacing")}
        caption={caption}
        downloadLabel={t("viewer.download")}
        downloadName={mediaDownloadName({ contentType: media.contentType, name: media.name })}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        onReplace={() => fileInputRef.current?.click()}
        open
        replaceLabel={t("replace")}
        src={media.urls.full}
        title={t("viewer.title")}
      />

      {pendingFile !== null && (
        <ImageCropDialog
          aspect={COVER_ASPECT}
          file={pendingFile}
          onCropped={(result) => void handleCropped(result)}
          onOpenChange={(open) => {
            if (!open) setPendingFile(null);
          }}
          open
        />
      )}
    </>
  );
}
