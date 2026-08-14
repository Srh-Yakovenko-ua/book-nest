import type { Nullable } from "@app/shared";

import { LOAN_PERSON_REQUIRED_MESSAGE, normalizeName } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { LoanContactModel } from "../../../generated/prisma/models.js";

import { BadRequestError, ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { LoanContactsRepository } from "../infrastructure/loan-contacts.repository.js";

export type ResolvedLoanContact = {
  contact: Nullable<string>;
  loanContactId: string;
  personName: string;
  refreshesPersonName: boolean;
};

export type ResolveLoanContactInput = {
  attached: Nullable<AttachedLoanContact>;
  contact: Nullable<string> | undefined;
  loanContactId: string | undefined;
  personName: string | undefined;
  userId: string;
};

type AttachedLoanContact = {
  contact: Nullable<string>;
  loanContactId: string;
  personName: string;
};

const LOAN_CONTACT_NOT_FOUND_MESSAGE = "Loan contact not found";

const LOAN_CONTACT_ARCHIVED = {
  code: "LOAN_CONTACT_ARCHIVED",
  message: "This contact is archived; restore it or choose another person",
} as const;

@Injectable()
export class LoanContactResolver {
  constructor(private readonly loanContactsRepository: LoanContactsRepository) {}

  async resolve(
    { attached, contact, loanContactId, personName, userId }: ResolveLoanContactInput,
    client?: Prisma.TransactionClient,
  ): Promise<ResolvedLoanContact> {
    const target = await this.loadTarget({ contact, loanContactId, personName, userId }, client);
    if (target === null) {
      if (attached === null) {
        throw new BadRequestError(LOAN_PERSON_REQUIRED_MESSAGE, {
          fields: [{ field: "personName", message: LOAN_PERSON_REQUIRED_MESSAGE }],
        });
      }
      return {
        contact: contact === undefined ? attached.contact : contact,
        loanContactId: attached.loanContactId,
        personName: attached.personName,
        refreshesPersonName: false,
      };
    }

    const keptAttachment =
      attached !== null && attached.loanContactId === target.id ? attached : null;
    if (target.archivedAt !== null && keptAttachment === null) {
      throw new ConflictError(LOAN_CONTACT_ARCHIVED.message, { code: LOAN_CONTACT_ARCHIVED.code });
    }

    return {
      contact: contact === undefined ? (keptAttachment?.contact ?? null) : contact,
      loanContactId: target.id,
      personName: target.name,
      refreshesPersonName: keptAttachment === null,
    };
  }

  private async loadTarget(
    { contact, loanContactId, personName, userId }: Omit<ResolveLoanContactInput, "attached">,
    client?: Prisma.TransactionClient,
  ): Promise<Nullable<LoanContactModel>> {
    if (loanContactId !== undefined) {
      const owned = await this.loanContactsRepository.findOwnedById(
        { id: loanContactId, userId },
        client,
      );
      if (owned === null) {
        throw new NotFoundError(LOAN_CONTACT_NOT_FOUND_MESSAGE);
      }
      return owned;
    }

    if (personName === undefined || personName.length === 0) {
      return null;
    }

    return this.loanContactsRepository.ensureByNormalizedName(
      {
        contact: contact ?? null,
        name: personName,
        normalizedName: normalizeName(personName),
        userId,
      },
      client,
    );
  }
}
