import { z } from "zod";

export const MEDIA_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MEDIA_MAX_UPLOAD_MB = MEDIA_MAX_UPLOAD_BYTES / (1024 * 1024);

export const MEDIA_DERIVATIVES = ["thumb", "card", "full"] as const;

export type MediaDerivative = (typeof MEDIA_DERIVATIVES)[number];

export const MediaKindSchema = z.enum(["avatar", "book_cover", "series_cover"]);

export type MediaKind = z.infer<typeof MediaKindSchema>;

export const MediaCropSchema = z.object({
  height: z.number().int().positive(),
  width: z.number().int().positive(),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
});

export type MediaCrop = z.infer<typeof MediaCropSchema>;

const parseCropJson = (value: unknown): unknown => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
};

export const MediaUploadInputSchema = z.object({
  crop: z.preprocess(parseCropJson, MediaCropSchema).optional(),
  kind: MediaKindSchema.default("book_cover"),
});

export type MediaUploadInput = z.infer<typeof MediaUploadInputSchema>;

export const MediaViewSchema = z.object({
  contentType: z.string(),
  createdAt: z.string(),
  height: z.number(),
  id: z.string(),
  kind: MediaKindSchema,
  name: z.string().nullable(),
  sizeBytes: z.number(),
  urls: z.object({
    card: z.string(),
    full: z.string(),
    thumb: z.string(),
  }),
  width: z.number(),
});

export type MediaView = z.infer<typeof MediaViewSchema>;
