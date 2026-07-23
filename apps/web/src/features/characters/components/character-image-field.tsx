"use client";

import { MEDIA_MAX_UPLOAD_BYTES, MEDIA_MAX_UPLOAD_MB } from "@app/shared";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
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

type CharacterImageFieldProps = {
  fallbackText: string;
  initialPreviewUrl?: string;
  label: string;
  onChange: (mediaId: null | string) => void;
  removeLabel: string;
  uploadLabel: string;
  value: null | string;
};

export function CharacterImageField({
  fallbackText,
  initialPreviewUrl,
  label,
  onChange,
  removeLabel,
  uploadLabel,
  value,
}: CharacterImageFieldProps) {
  const t = useTranslations("books.cover");
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(initialPreviewUrl);
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
        onSuccess: (media) => {
          setPreviewUrl(media.urls.card);
          onChange(media.id);
        },
      },
    );
  }

  function removeImage() {
    setPreviewUrl(undefined);
    onChange(null);
  }

  const hasImage = value !== null && previewUrl !== undefined;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-4">
        <Avatar
          className="size-16 bg-gradient-to-br from-accent-border to-primary text-primary-foreground"
          size="lg"
        >
          {previewUrl === undefined ? null : <AvatarImage alt={label} src={previewUrl} />}
          <AvatarFallback className="bg-transparent font-heading text-2xl font-bold text-primary-foreground">
            {fallbackText.trim().charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-col gap-2">
          <Button
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
          {hasImage ? (
            <Button onClick={removeImage} size="sm" type="button" variant="ghost">
              <UiIcon name="trash" size={16} />
              {removeLabel}
            </Button>
          ) : null}
        </div>
      </div>

      <input
        accept={ACCEPT_ATTR}
        aria-label={uploadLabel}
        className="sr-only"
        onChange={(event) => {
          void pickFile(event.target.files?.[0]);
          event.target.value = "";
        }}
        ref={inputRef}
        tabIndex={-1}
        type="file"
      />
    </div>
  );
}
