import type { ProfileView, UpdateProfileInput } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { toProfileView } from "../domain/profile.mapper.js";
import { ProfileRepository } from "../infrastructure/profile.repository.js";

const UNIQUE_CONSTRAINT_CODE = "P2002";

@Injectable()
export class ProfileService {
  constructor(private readonly profileRepository: ProfileRepository) {}

  async getProfile(userId: string): Promise<ProfileView> {
    const user = await this.profileRepository.findByUserId(userId);
    if (user === null) {
      throw new NotFoundError("Profile not found");
    }

    return toProfileView(user);
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<ProfileView> {
    const data = buildUpdateData(input);

    try {
      const user = await this.profileRepository.update(userId, data);
      return toProfileView(user);
    } catch (error) {
      if (isNicknameConflict(error)) {
        throw new ConflictError("Nickname already taken");
      }
      throw error;
    }
  }
}

function buildUpdateData(input: UpdateProfileInput): Prisma.UserUpdateInput {
  const data: Prisma.UserUpdateInput = {};

  if (input.name !== undefined) data.name = input.name;
  if (input.lastName !== undefined) data.lastName = input.lastName;
  if (input.nickname !== undefined) data.nickname = input.nickname;
  if (input.dateOfBirth !== undefined) {
    data.dateOfBirth =
      input.dateOfBirth === null ? null : new Date(`${input.dateOfBirth}T00:00:00.000Z`);
  }
  if (input.bio !== undefined) data.bio = input.bio;
  if (input.favoriteBookQuote !== undefined) data.favoriteBookQuote = input.favoriteBookQuote;
  if (input.favoriteGenres !== undefined) data.favoriteGenres = input.favoriteGenres;

  return data;
}

function isNicknameConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_CODE
  );
}
