import type { DedicationsView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { computeDedicationsSummary } from "../domain/dedications-summary.js";
import { BooksRepository } from "../infrastructure/books.repository.js";
import { BookViewAssembler } from "./book-view-assembler.js";

@Injectable()
export class DedicationsService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly bookViewAssembler: BookViewAssembler,
  ) {}

  async getDedications({ userId }: { userId: string }): Promise<DedicationsView> {
    const rows = await this.booksRepository.listDedicationBooks({ userId });
    const books = rows.map((row) => this.bookViewAssembler.viewOf(row));

    return {
      books,
      summary: computeDedicationsSummary({ books }),
    };
  }
}
