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
  | "character-relationships/person-guided-start"
  | "email-sent"
  | "email-verified"
  | "empty-all-books"
  | "empty-authors"
  | "empty-borrowed"
  | "empty-characters"
  | "empty-contacts"
  | "empty-dedications"
  | "empty-delivery"
  | "empty-favorites"
  | "empty-genres"
  | "empty-library"
  | "empty-lists"
  | "empty-notes"
  | "empty-publishers"
  | "empty-purchases"
  | "empty-queue"
  | "empty-quotes"
  | "empty-reading-history-en"
  | "empty-reading-history-uk"
  | "empty-search"
  | "empty-series"
  | "empty-tags"
  | "error-generic"
  | "error-not-found"
  | "maintenance"
  | "reading-goals/goal-expired-hourglass"
  | "reading-goals/goal-first-goal-empty-state"
  | "reading-goals/goal-no-counted-books-yet";

export type EmptyStateIllustrationSize = "lg" | "sm" | "xl" | "xs";

export type EmptyStateLayout = "inline" | "stacked";
