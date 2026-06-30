"use client";

import type { MediaCrop } from "@app/shared";

import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
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
import { Label } from "@/components/ui/label";

type ImageCropDialogProps = {
  aspect: number;
  file: File | null;
  onCloseAutoFocus?: (event: Event) => void;
  onCropped: (result: { crop: MediaCrop; file: File }) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.05;
const KEYBOARD_PAN_STEP = 10;

type CoverCropEditorProps = {
  aspect: number;
  file: File;
  onCancel: () => void;
  onConfirm: (crop: MediaCrop) => void;
};

export function ImageCropDialog({
  aspect,
  file,
  onCloseAutoFocus,
  onCropped,
  onOpenChange,
  open,
}: ImageCropDialogProps) {
  const t = useTranslations("books.cover.crop");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {file === null ? null : (
          <CoverCropEditor
            aspect={aspect}
            file={file}
            key={`${file.name}:${file.size}:${file.lastModified}`}
            onCancel={() => onOpenChange(false)}
            onConfirm={(crop) => {
              onCropped({ crop, file });
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CoverCropEditor({ aspect, file, onCancel, onConfirm }: CoverCropEditorProps) {
  const t = useTranslations("books.cover.crop");
  const zoomId = useId();

  const [imageSrc, setImageSrc] = useState<null | string>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);

  useEffect(() => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        setImageSrc(reader.result);
      }
    });
    reader.addEventListener("error", () => {
      toast.error(t("error"));
      onCancel();
    });
    reader.readAsDataURL(file);
    return () => reader.abort();
  }, [file, onCancel, t]);

  function handleConfirm() {
    if (area === null) return;
    onConfirm({
      height: Math.round(area.height),
      width: Math.round(area.width),
      x: Math.round(area.x),
      y: Math.round(area.y),
    });
  }

  return (
    <>
      <div className="relative h-80 w-full overflow-hidden rounded-xl bg-muted">
        {imageSrc === null ? null : (
          <Cropper
            aspect={aspect}
            crop={crop}
            cropperProps={{ "aria-label": t("region"), role: "group" }}
            image={imageSrc}
            keyboardStep={KEYBOARD_PAN_STEP}
            maxZoom={ZOOM_MAX}
            minZoom={ZOOM_MIN}
            onCropChange={setCrop}
            onCropComplete={(_, areaPixels) => setArea(areaPixels)}
            onZoomChange={setZoom}
            zoom={zoom}
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={zoomId}>{t("zoom")}</Label>
        <input
          className="w-full cursor-pointer accent-primary"
          id={zoomId}
          max={ZOOM_MAX}
          min={ZOOM_MIN}
          onChange={(event) => setZoom(Number(event.target.value))}
          step={ZOOM_STEP}
          type="range"
          value={zoom}
        />
      </div>

      <DialogFooter>
        <Button onClick={onCancel} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button disabled={area === null} onClick={handleConfirm} type="button">
          {t("confirm")}
        </Button>
      </DialogFooter>
    </>
  );
}
