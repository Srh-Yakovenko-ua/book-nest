import type {
  CreateSocialLinkInput,
  Nullable,
  SocialLinkView,
  SocialPlatform,
  UpdateSocialLinkInput,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { UserSocialLinkModel } from "../../../generated/prisma/models.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { toSocialLinkView } from "../domain/social-link.mapper.js";
import { SocialLinkRepository } from "../infrastructure/social-link.repository.js";

const MAX_SOCIAL_LINKS = 10;
const OTHER_PLATFORM: SocialPlatform = "OTHER";

@Injectable()
export class SocialLinkService {
  constructor(
    private readonly socialLinkRepository: SocialLinkRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async create(userId: string, input: CreateSocialLinkInput): Promise<SocialLinkView> {
    const existing = await this.socialLinkRepository.listByUserId(userId);

    if (input.platform !== OTHER_PLATFORM && hasPlatform(existing, input.platform)) {
      throw new ConflictError("This platform is already linked");
    }

    if (input.url !== undefined && hasUrl(existing, input.url)) {
      throw new ConflictError("This link is already added");
    }

    const created = await this.transactionRunner.run(async (tx) => {
      const count = await this.socialLinkRepository.countByUserId(userId, tx);
      if (count >= MAX_SOCIAL_LINKS) {
        throw new BadRequestError("Maximum of 10 social links");
      }

      return this.socialLinkRepository.create(
        userId,
        {
          label: input.label ?? null,
          platform: input.platform,
          url: input.url ?? null,
          username: input.username ?? null,
        },
        tx,
      );
    });

    return toSocialLinkView(created);
  }

  async delete(userId: string, linkId: string): Promise<void> {
    const link = await this.socialLinkRepository.findById(linkId);
    if (link === null || link.userId !== userId) {
      throw new NotFoundError("Social link not found");
    }

    await this.socialLinkRepository.deleteById(linkId);
  }

  async update(
    userId: string,
    linkId: string,
    input: UpdateSocialLinkInput,
  ): Promise<SocialLinkView> {
    const link = await this.socialLinkRepository.findById(linkId);
    if (link === null || link.userId !== userId) {
      throw new NotFoundError("Social link not found");
    }

    const resultingUsername = input.username === undefined ? link.username : input.username;
    const resultingUrl = input.url === undefined ? link.url : input.url;

    if (isEmpty(resultingUsername) && isEmpty(resultingUrl)) {
      throw new BadRequestError("Add a username or a profile link");
    }

    const resultingPlatform = input.platform ?? link.platform;
    const others = (await this.socialLinkRepository.listByUserId(userId)).filter(
      (existing) => existing.id !== linkId,
    );

    if (resultingPlatform !== OTHER_PLATFORM && hasPlatform(others, resultingPlatform)) {
      throw new ConflictError("This platform is already linked");
    }

    if (resultingUrl !== null && hasUrl(others, resultingUrl)) {
      throw new ConflictError("This link is already added");
    }

    const updated = await this.socialLinkRepository.update(linkId, buildUpdateData(input));

    return toSocialLinkView(updated);
  }
}

function buildUpdateData(input: UpdateSocialLinkInput): Prisma.UserSocialLinkUpdateInput {
  const data: Prisma.UserSocialLinkUpdateInput = {};

  if (input.platform !== undefined) data.platform = input.platform;
  if (input.username !== undefined) data.username = input.username;
  if (input.url !== undefined) data.url = input.url;
  if (input.label !== undefined) data.label = input.label;

  return data;
}

function hasPlatform(links: UserSocialLinkModel[], platform: string): boolean {
  return links.some((link) => link.platform === platform);
}

function hasUrl(links: UserSocialLinkModel[], url: string): boolean {
  return links.some((link) => link.url === url);
}

function isEmpty(value: Nullable<string>): boolean {
  return value === null || value.length === 0;
}
