import type { ChangelogListResponse, ChangelogLocale, Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { isPublishedEntry, toChangelogEntryView } from "../domain/changelog-entry.mapper.js";
import { ChangelogRepository } from "../infrastructure/changelog.repository.js";

type ComputeUnreadCountInput = {
  now: Date;
  userId: Nullable<string>;
};

type ListInput = {
  cursor: string | undefined;
  limit: number | undefined;
  locale: ChangelogLocale;
  userId: Nullable<string>;
};

@Injectable()
export class ChangelogService {
  constructor(private readonly changelogRepository: ChangelogRepository) {}

  async list({ cursor, limit, locale, userId }: ListInput): Promise<ChangelogListResponse> {
    const now = new Date();

    const rows = await this.changelogRepository.findPublished({ cursor, limit, now });
    const publishedRows = rows.filter(isPublishedEntry);

    const hasMore = limit !== undefined && publishedRows.length > limit;
    const pageRows = hasMore ? publishedRows.slice(0, limit) : publishedRows;
    const entries = pageRows.map((entry) => toChangelogEntryView({ entry, locale }));

    const lastEntry = entries.at(-1);
    const nextCursor: Nullable<string> = hasMore && lastEntry !== undefined ? lastEntry.id : null;

    const unreadCount = await this.computeUnreadCount({ now, userId });

    return { entries, nextCursor, unreadCount };
  }

  async markSeen({ userId }: { userId: string }): Promise<void> {
    await this.changelogRepository.upsertRead({ lastSeenAt: new Date(), userId });
  }

  private async computeUnreadCount({ now, userId }: ComputeUnreadCountInput): Promise<number> {
    if (userId === null) {
      return 0;
    }

    const read = await this.changelogRepository.getRead(userId);
    if (read === null) {
      return this.changelogRepository.countPublished({ now });
    }

    return this.changelogRepository.countPublishedAfter({ after: read.lastSeenAt, now });
  }
}
