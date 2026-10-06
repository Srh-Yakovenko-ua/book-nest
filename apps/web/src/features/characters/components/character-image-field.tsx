"use client";

import type { Nullable } from "@app/shared";

import { MEDIA_MAX_UPLOAD_BYTES, MEDIA_MAX_UPLOAD_MB } from "@app/shared";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadButtonRef = useRef<HTMLButtonElement>(null);
  const uploadMedia = useUploadMedia();

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
        onSuccess: (media) => onUpload({ mediaId: media.id, previewUrl: media.urls.card }),
      },
    );
  }

  const canRemove = value !== null;

  return (
    <div className="flex flex-col gap-4">
      <Avatar className="size-20 bg-gradient-to-br from-accent-border to-primary text-primary-foreground">
        {previewUrl === null ? null : <AvatarImage alt={alt} src={previewUrl} />}
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
          ref={uploadButtonRef}
          size="sm"
          type="button"
          variant="secondary"
        >
          <UiIcon name="upload" size={16} />
          {uploadLabel}
        </Button>
        {canRemove ? (
          <Button
            className="h-auto min-h-7 w-full py-1 text-center whitespace-normal"
            onClick={() => {
              onReset();
              uploadButtonRef.current?.focus();
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            <UiIcon name="trash" size={16} />
            {removeLabel}
          </Button>
        ) : null}
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
