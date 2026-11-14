import type { UiIconName } from "@/components/icons";

export type EmptyStateAction = {
  icon: UiIconName;
  label: string;
};

export type EmptyStateEntry = {
  desc: string;
  illu: EmptyStateIllustration;
  illuSize?: EmptyStateIllustrationSize;
  primary?: EmptyStateAction;
  secondary?: EmptyStateAction;
  title: string;
};

export type EmptyStateIllustration =
  | "empty-all-books"
  | "empty-authors"
  | "empty-borrowed"
  | "empty-delivery"
  | "empty-favorites"
  | "empty-library"
  | "empty-lists"
  | "empty-notes"
  | "empty-publishers"
  | "empty-purchases"
  | "empty-queue"
  | "empty-quotes"
  | "empty-search"
  | "empty-series"
  | "empty-tags"
  | "error-generic";

export type EmptyStateIllustrationSize = "lg" | "md" | "sm";
