"use client";

import type { Nullable } from "@app/shared";

import { MEDIA_MAX_UPLOAD_BYTES, MEDIA_MAX_UPLOAD_MB } from "@app/shared";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Upload } from "@/components/ui/upload";
import {
  ACCEPT_ATTR,
  ACCEPTED_IMAGE_TYPES,
  normalizeImageFile,
  useUploadMedia,
} from "@/features/media";

export type CharacterImageUpload = {
  mediaId: string;
  previewUrl: string;
};

type CharacterImageFieldProps = {
  alt: string;
  fallbackText: string;
  onReset: () => void;
  onUpload: (upload: CharacterImageUpload) => void;
  previewUrl: Nullable<string>;
  removeLabel: string;
  uploadLabel: string;
  value: Nullable<string>;
};

export function CharacterImageField({
  alt,
  fallbackText,
  onReset,
  onUpload,
  previewUrl,
  removeLabel,
  uploadLabel,
  value,
}: CharacterImageFieldProps) {
  const t = useTranslations("books.cover");
  const tEdit = useTranslations("characters.edit");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMedia = useUploadMedia();

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

  function commitThenFocusFirstButton(commit: () => void) {
    flushSync(commit);
    focusFirstButtonUnlessFocusIsElsewhere(containerRef.current);
  }

  const resetButton =
    value === null ? null : (
      <Button
        className="h-auto min-h-7 w-full py-1 text-center whitespace-normal"
        disabled={uploadMedia.isPending}
        onClick={() => commitThenFocusFirstButton(onReset)}
        size="sm"
        type="button"
        variant="ghost"
      >
        <UiIcon name="trash" size={16} />
        {removeLabel}
      </Button>
    );

  if (previewUrl === null) {
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
          <div role="status">
            {uploadMedia.isPending ? (
              <p className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in">
                <UiIcon className="motion-safe:animate-spin" name="refresh" size={16} />
                {tEdit("portraitUploading")}
              </p>
            ) : null}
          </div>
        </div>
        {resetButton}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" ref={containerRef}>
      <Avatar className="size-20 bg-gradient-to-br from-accent-border to-primary text-primary-foreground">
        <AvatarImage alt={alt} src={previewUrl} />
        <AvatarFallback className="bg-transparent font-heading text-3xl font-bold text-primary-foreground">
          {fallbackText.trim().charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col gap-2">
        <Button
          className="h-auto min-h-7 w-full py-1 text-center whitespace-normal"
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
        {resetButton}
      </div>

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
