import type { MediaView, OwnershipStatus, ReadingStatus } from "@app/shared";

import type { GenreIconName } from "@/components/icons";
import type { StatusEntry } from "@/lib/book-status";

export type LibraryBook = {
  authors: string[];
  cover?: { alt?: string; src: string };
  coverMedia?: MediaView;
  genres?: { icon?: GenreIconName; label: string }[];
  href: string;
  id: string;
  isFavorite: boolean;
  isInReadingQueue: boolean;
  ownership?: StatusEntry;
  ownershipStatus: OwnershipStatus;
  pagesText?: string;
  progress?: { ariaLabel: string; current: number; total: number; unit: string };
  publisher?: string;
  rating?: number;
  ratingLabel?: string;
  readingStatus: ReadingStatus;
  selected?: boolean;
  series?: string;
  status: StatusEntry;
  tags?: string[];
  title: string;
  year?: number;
};

export type LibraryBookLinkComponent = React.ComponentType<{
  children?: React.ReactNode;
  className?: string;
  href: string;
}>;
