import type {
  CreateLoanContactInput,
  LoanContactsQuery,
  LoanContactsView,
  LoanContactView,
  Nullable,
  UpdateLoanContactInput,
} from "@app/shared";

import { LOAN_CONTACT_ERROR_CODES, normalizeName, normalizeSearch } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { LoanContactRename } from "../infrastructure/loan-contacts.repository.js";

import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { isRecordNotFoundError, isUniqueConstraintError } from "../../../core/prisma-errors.js";
import { toLoanContactView } from "../domain/loan-contact.mapper.js";
import { LoanContactsRepository } from "../infrastructure/loan-contacts.repository.js";

const LOAN_CONTACT_NOT_FOUND_MESSAGE = "Loan contact not found";

const LOAN_CONTACT_NAME_CONFLICT = {
  archived: {
    code: LOAN_CONTACT_ERROR_CODES.archivedName,
    message: "An archived contact already uses this name",
  },
  live: {
    code: LOAN_CONTACT_ERROR_CODES.duplicateName,
    message: "A contact with this name already exists",
  },
} as const;

@Injectable()
export class LoanContactsService {
  constructor(private readonly loanContactsRepository: LoanContactsRepository) {}

  async create({
    input,
    userId,
  }: {
    input: CreateLoanContactInput;
    userId: string;
  }): Promise<LoanContactView> {
    const normalizedName = normalizeName(input.name);
    try {
      const created = await this.loanContactsRepository.create({
        contact: toStoredContact(input.contact),
        name: input.name,
        normalizedName,
        userId,
      });
      return toLoanContactView(created);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw await this.buildNameConflict({ normalizedName, userId });
      }
      throw error;
    }
  }

  async list({
    query,
    userId,
  }: {
    query: LoanContactsQuery;
    userId: string;
  }): Promise<LoanContactsView> {
    const contacts = await this.loanContactsRepository.listOwned({
      includeArchived: query.includeArchived,
      limit: query.limit,
      search: normalizeSearch(query.search),
      userId,
    });
    return { items: contacts.map(toLoanContactView) };
  }

  async update({
    contactId,
    input,
    userId,
  }: {
    contactId: string;
    input: UpdateLoanContactInput;
    userId: string;
  }): Promise<LoanContactView> {
    const rename = toRename(input.name);
    try {
      const updated = await this.loanContactsRepository.updateOwned({
        contact: input.contact === undefined ? undefined : toStoredContact(input.contact),
        id: contactId,
        rename,
        userId,
      });
      return toLoanContactView(updated);
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new NotFoundError(LOAN_CONTACT_NOT_FOUND_MESSAGE);
      }
      if (isUniqueConstraintError(error) && rename !== undefined) {
        throw await this.buildNameConflict({ normalizedName: rename.normalizedName, userId });
      }
      throw error;
    }
  }

  private async buildNameConflict({
    normalizedName,
    userId,
  }: {
    normalizedName: string;
    userId: string;
  }): Promise<ConflictError> {
    const existing = await this.loanContactsRepository.findByNormalizedName({
      normalizedName,
      userId,
    });
    const conflict =
      existing !== null && existing.archivedAt !== null
        ? LOAN_CONTACT_NAME_CONFLICT.archived
        : LOAN_CONTACT_NAME_CONFLICT.live;
    return new ConflictError(conflict.message, { code: conflict.code });
  }
}

function toRename(name: string | undefined): LoanContactRename | undefined {
  return name === undefined ? undefined : { name, normalizedName: normalizeName(name) };
}

function toStoredContact(contact: Nullable<string> | undefined): Nullable<string> {
  return contact === undefined || contact === null || contact.length === 0 ? null : contact;
}
