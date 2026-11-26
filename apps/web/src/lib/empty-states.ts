import type { UiIconName } from "@/components/icons";

export type EmptyStateAction = {
  icon: UiIconName;
  label: string;
};

export type EmptyStateEntry = {
  desc: string;
  illu: EmptyStateIllustration;
  illuSize?: EmptyStateIllustrationSize;
  layout?: EmptyStateLayout;
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
  | "error-generic"
  | "reading-goals/goal-first-goal-empty-state"
  | "reading-goals/goal-no-counted-books-yet";

export type EmptyStateIllustrationSize = "lg" | "md" | "sm" | "xs";

export type EmptyStateLayout = "inline" | "stacked";
