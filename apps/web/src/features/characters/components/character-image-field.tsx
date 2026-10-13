"use client";

import type { Nullable } from "@app/shared";

import { MEDIA_MAX_UPLOAD_BYTES, MEDIA_MAX_UPLOAD_MB } from "@app/shared";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Upload } from "@/components/ui/upload";
import {
  ACCEPT_ATTR,
  ACCEPTED_IMAGE_TYPES,
  normalizeImageFile,
  useUploadMedia,
} from "@/features/media";
import { cn } from "@/lib/utils";

export type CharacterImageUpload = {
  mediaId: string;
  previewUrl: string;
};

type CharacterImageFieldProps = {
  alt: string;
  fallbackText: string;
  onUpload: (upload: CharacterImageUpload) => void;
  previewUrl: Nullable<string>;
  reset?: CharacterImageReset;
  uploadLabel: string;
  variant?: CharacterImageFieldVariant;
};

type CharacterImageFieldVariant = keyof typeof VARIANT_STYLES;

type CharacterImageReset = {
  label: string;
  onReset: () => void;
  tooltip?: string;
};

const VARIANT_STYLES = {
  compact: {
    avatar: "size-16",
    button: undefined,
    controls: "flex flex-wrap items-center gap-2",
    fallback: "text-2xl",
    status: "text-xs",
    statusIconSize: 14,
  },
  default: {
    avatar: "size-20",
    button: "h-auto min-h-7 w-full py-1 text-center whitespace-normal",
    controls: "flex flex-col gap-2",
    fallback: "text-3xl",
    status: "mt-4 text-sm",
    statusIconSize: 16,
  },
} as const;

export function CharacterImageField({
  alt,
  fallbackText,
  onUpload,
  previewUrl,
  reset,
  uploadLabel,
  variant = "default",
}: CharacterImageFieldProps) {
  const t = useTranslations("books.cover");
  const tEdit = useTranslations("characters.edit");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMedia = useUploadMedia();
  const styles = VARIANT_STYLES[variant];
  const hintId = useId();
  const dragDepth = useRef(0);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    if (uploadMedia.isError) focusFirstButtonUnlessFocusIsElsewhere(containerRef.current);
  }, [uploadMedia.isError]);

  async function pickFile(file: File | undefined) {
    if (file === undefined) return;
    if (file.size > MEDIA_MAX_UPLOAD_BYTES) {
      toast.error(t("errors.size", { max: MEDIA_MAX_UPLOAD_MB }));
      return;
    }

    let normalized: File;
    try {
      normalized = await normalizeImageFile(file);
    } catch {
      toast.error(t("errors.heic"));
      return;
    }

    if (!ACCEPTED_IMAGE_TYPES.includes(normalized.type)) {
      toast.error(t("errors.type"));
      return;
    }

    uploadMedia.mutate(
      { file: normalized, kind: "avatar" },
      {
        onError: () => toast.error(t("errors.type")),
        onSuccess: (media) =>
          commitThenFocusFirstButton(() =>
            onUpload({ mediaId: media.id, previewUrl: media.urls.card }),
          ),
      },
    );
  }

  function acceptsDroppedFiles(dataTransfer: DataTransfer): boolean {
    return !uploadMedia.isPending && dataTransfer.types.includes("Files");
  }

  function endDrag() {
    dragDepth.current = 0;
    setIsDragOver(false);
  }

  function commitThenFocusFirstButton(commit: () => void) {
    flushSync(commit);
    focusFirstButtonUnlessFocusIsElsewhere(containerRef.current);
  }

  const resetButton =
    reset === undefined ? null : (
      <Button
        className={styles.button}
        disabled={uploadMedia.isPending}
        onClick={() => commitThenFocusFirstButton(reset.onReset)}
        size="sm"
        type="button"
        variant="ghost"
      >
        <UiIcon name="trash" size={16} />
        {reset.label}
      </Button>
    );

  const resetControl =
    reset?.tooltip === undefined ? (
      resetButton
    ) : (
      <Tooltip>
        <TooltipTrigger asChild>{resetButton}</TooltipTrigger>
        <TooltipContent>{reset.tooltip}</TooltipContent>
      </Tooltip>
    );

  const uploadStatus = (
    <div role="status">
      {uploadMedia.isPending ? (
        <p
          className={cn(
            "flex items-center gap-1.5 text-muted-foreground motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in",
            styles.status,
          )}
        >
          <UiIcon
            className="motion-safe:animate-spin"
            name="refresh"
            size={styles.statusIconSize}
          />
          {tEdit("portraitUploading")}
        </p>
      ) : null}
    </div>
  );

  if (variant === "default" && previewUrl === null) {
    return (
      <div className="flex flex-col gap-4" ref={containerRef}>
        <div>
          <Upload
            accept={ACCEPT_ATTR}
            browseLabel={uploadLabel}
            className="[&_[data-slot=button]]:h-auto [&_[data-slot=button]]:min-h-11 [&_[data-slot=button]]:py-2 [&_[data-slot=button]]:text-center [&_[data-slot=button]]:whitespace-normal"
            disabled={uploadMedia.isPending}
            files={[]}
            hint={
              <>
                <p>{t("upload.formats", { max: MEDIA_MAX_UPLOAD_MB })}</p>
                <p>{t("upload.paste")}</p>
              </>
            }
            media={
              <Image
                alt=""
                aria-hidden
                className="h-auto w-44 select-none"
                height={500}
                sizes="176px"
                src="/illustrations/avatar-upload.png"
                width={500}
              />
            }
            onFilesChange={(files) => void pickFile(files[0])}
            title={t("upload.title")}
          />
          {uploadStatus}
        </div>
        {resetControl}
      </div>
    );
  }

  const isCompact = variant === "compact";

  const controls = (
    <div className={styles.controls}>
      <Button
        aria-describedby={isCompact ? hintId : undefined}
        className={styles.button}
        disabled={uploadMedia.isPending}
        loading={uploadMedia.isPending}
        onClick={() => inputRef.current?.click()}
        size="sm"
        type="button"
        variant="secondary"
      >
        <UiIcon name="upload" size={16} />
        {uploadLabel}
      </Button>
      {resetControl}
    </div>
  );

  const avatar = (
    <Avatar
      className={cn(
        "bg-gradient-to-br from-accent-border to-primary text-primary-foreground",
        styles.avatar,
      )}
    >
      {previewUrl === null ? null : <AvatarImage alt={alt} src={previewUrl} />}
      <AvatarFallback
        className={cn(
          "bg-transparent font-heading font-bold text-primary-foreground",
          styles.fallback,
        )}
      >
        {fallbackText.trim().charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );

  const fileInput = (
    <input
      accept={ACCEPT_ATTR}
      aria-label={uploadLabel}
      className="hidden"
      onChange={(event) => {
        void pickFile(event.target.files?.[0]);
        event.target.value = "";
      }}
      ref={inputRef}
      type="file"
    />
  );

  if (!isCompact) {
    return (
      <div className="flex flex-col gap-4" ref={containerRef}>
        {avatar}
        {controls}
        {fileInput}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group/image-field -m-2 flex items-center gap-4 rounded-xl p-2 transition-[background-color,box-shadow] duration-200 ease-out",
        isDragOver && "bg-accent/40 ring-2 ring-accent-border",
      )}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!acceptsDroppedFiles(event.dataTransfer)) return;
        dragDepth.current += 1;
        setIsDragOver(true);
      }}
      onDragLeave={() => {
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) endDrag();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!acceptsDroppedFiles(event.dataTransfer)) event.dataTransfer.dropEffect = "none";
      }}
      onDrop={(event) => {
        event.preventDefault();
        endDrag();
        if (uploadMedia.isPending) return;
        void pickFile(event.dataTransfer.files[0]);
      }}
      onPaste={(event) => {
        if (uploadMedia.isPending) return;
        const image = Array.from(event.clipboardData.files).find((file) =>
          file.type.startsWith("image/"),
        );
        if (image === undefined) return;
        event.preventDefault();
        void pickFile(image);
      }}
      ref={containerRef}
    >
      {avatar}
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        {controls}
        {uploadStatus}
        <p
          className={cn(
            "text-xs text-muted-foreground",
            !isDragOver && "sr-only group-focus-within/image-field:not-sr-only",
          )}
          id={hintId}
        >
          {isDragOver ? tEdit("imageDropHint") : t("upload.paste")}
        </p>
      </div>
      {fileInput}
    </div>
  );
}

function focusFirstButtonUnlessFocusIsElsewhere(container: Nullable<HTMLElement>) {
  if (container === null) return;
  const focused = document.activeElement;
  const focusIsElsewhere = focused !== document.body && !container.contains(focused);
  if (focusIsElsewhere) return;
  container.querySelector<HTMLElement>("button:not([tabindex='-1']):not(:disabled)")?.focus();
}
