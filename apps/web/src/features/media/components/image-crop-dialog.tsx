"use client";

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
import { createLogger } from "@/lib/logger";

import { cropImageToFile } from "../lib/crop-image";

type ImageCropDialogProps = {
  aspect: number;
  file: File | null;
  onCloseAutoFocus?: (event: Event) => void;
  onCropped: (file: File) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.05;
const KEYBOARD_PAN_STEP = 10;

const logger = createLogger("image-crop-dialog");

export function ImageCropDialog({
  aspect,
  file,
  onCloseAutoFocus,
  onCropped,
  onOpenChange,
  open,
}: ImageCropDialogProps) {
  const t = useTranslations("books.cover.crop");
  const zoomId = useId();

  const [imageSrc, setImageSrc] = useState<null | string>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (file === null) {
      setImageSrc(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function handleConfirm() {
    if (imageSrc === null || area === null) return;
    setIsProcessing(true);
    try {
      const cropped = await cropImageToFile({ area, imageSrc, sourceName: file?.name });
      onCropped(cropped);
      onOpenChange(false);
    } catch (error) {
      logger.error("Failed to crop cover image", { error });
      toast.error(t("error"));
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

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
          <Button onClick={() => onOpenChange(false)} type="button" variant="secondary">
            {t("cancel")}
          </Button>
          <Button
            disabled={area === null || isProcessing}
            loading={isProcessing}
            onClick={handleConfirm}
            type="button"
          >
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
