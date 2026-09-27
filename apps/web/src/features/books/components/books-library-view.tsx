"use client";

import type { LibraryArchiveViewProps } from "./library-archive-view";
import type { LibraryPageHeaderProps } from "./library-page-header";

import { LibraryArchiveView } from "./library-archive-view";
import { LibraryPageHeader } from "./library-page-header";

type BooksLibraryViewProps = LibraryPageHeaderProps &
  Omit<LibraryArchiveViewProps, "header" | "libraryTotalLoading" | "showPublisher">;

export function BooksLibraryView(props: BooksLibraryViewProps) {
  return (
    <LibraryArchiveView
      {...props}
      header={
        <LibraryPageHeader
          addBookLabel={props.addBookLabel}
          onAddBook={props.onAddBook}
          subtitle={props.subtitle}
          summaryCards={props.summaryCards}
          summaryLoading={props.summaryLoading}
          summaryMobileAction={props.summaryMobileAction}
          summaryMobileCards={props.summaryMobileCards}
          summaryMobileLayout={props.summaryMobileLayout}
          title={props.title}
        />
      }
      libraryTotalLoading={props.summaryLoading}
    />
  );
}
