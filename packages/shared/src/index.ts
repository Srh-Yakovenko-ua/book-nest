import { z } from "zod";

export type ApiError = {
  code?: string;
  message: string;
  requestId?: string;
};

export type ApiErrorResult = {
  errorsMessages: FieldError[];
};

export type ApiHealth = {
  postgres: "down" | "ok";
  status: "degraded" | "down" | "ok";
  timestamp: string;
  uptimeSeconds: number;
};

export type FieldError = {
  field: string;
  message: string;
};

export type Nullable<T> = null | T;

export type Paginator<T> = {
  items: T[];
  page: number;
  pagesCount: number;
  pageSize: number;
  totalCount: number;
};

export type ValueOf<T> = T[keyof T];

export const LIST_PAGE_SIZE_MAX = 100;

export const PaginationQuerySchema = z.object({
  pageNumber: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(LIST_PAGE_SIZE_MAX).default(10),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

const NAME_MIN = 2;
const NAME_MAX = 50;
const NAME_ALLOWED = /^[\p{L}\p{M} '’-]+$/u;
const NAME_HAS_LETTER = /\p{L}/u;
const EMAIL_MAX = 254;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const PASSWORD_UPPERCASE = /[A-Z]/;
const PASSWORD_LOWERCASE = /[a-z]/;
const PASSWORD_DIGIT = /[0-9]/;
const PASSWORD_SPECIAL = /[^A-Za-z0-9]/;
const NICKNAME_MIN = 3;
const NICKNAME_MAX = 20;
const NICKNAME_PATTERN = /^[A-Za-z0-9._]+$/;
const NICKNAME_EDGES = /^[A-Za-z0-9].*[A-Za-z0-9]$/;
const NICKNAME_NO_REPEAT = /^(?!.*(?:\.\.|__))/;

const HTML_TAG = /<\/?[a-zA-Z][^>]*>|<!--|<!\w/;

export const noHtmlTags = (value: string): boolean => !HTML_TAG.test(value);

export function collapseHorizontalSpaces(value: string): string {
  return value.replace(/[^\S\n]+/g, " ").trim();
}

export function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export const NicknameSchema = z
  .string()
  .trim()
  .min(NICKNAME_MIN, "Nickname must be at least 3 characters long")
  .max(NICKNAME_MAX, "Nickname must be at most 20 characters long")
  .regex(NICKNAME_PATTERN, "Nickname may contain only Latin letters, digits, underscore and dot")
  .regex(NICKNAME_EDGES, "Nickname must start and end with a letter or digit")
  .regex(NICKNAME_NO_REPEAT, "Nickname must not contain consecutive dots or underscores");

export const PasswordSchema = z
  .string()
  .min(PASSWORD_MIN, "Password must be at least 8 characters long")
  .max(PASSWORD_MAX, "Password must be at most 128 characters long")
  .regex(PASSWORD_UPPERCASE, "Password must contain at least one uppercase letter")
  .regex(PASSWORD_LOWERCASE, "Password must contain at least one lowercase letter")
  .regex(PASSWORD_DIGIT, "Password must contain at least one digit")
  .regex(PASSWORD_SPECIAL, "Password must contain at least one special character");

export const RegistrationInputSchema = z.object({
  dateOfBirth: z.iso.date().optional(),
  email: z.string().trim().toLowerCase().pipe(z.email().max(EMAIL_MAX)),
  name: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(NAME_MIN, "Name must be at least 2 characters long")
        .max(NAME_MAX, "Name must be at most 50 characters long")
        .regex(NAME_ALLOWED, "Name may contain only letters, spaces, apostrophes and hyphens")
        .regex(NAME_HAS_LETTER, "Name must contain at least one letter"),
    ),
  nickname: NicknameSchema.optional(),
  password: PasswordSchema,
});

export const RoleSchema = z.enum(["user", "super_admin"]);

export type Role = z.infer<typeof RoleSchema>;

export const LoginInputSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

export const NicknameAvailabilityQuerySchema = z.object({
  nickname: NicknameSchema,
});

export type NicknameAvailabilityQuery = z.infer<typeof NicknameAvailabilityQuerySchema>;

export type NicknameAvailabilityView = {
  available: boolean;
};

export const VerifyEmailSchema = z.object({
  token: z.string().min(1),
});

export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;

export const ResendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
});

export const ForgotPasswordInputSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInputSchema>;

export const ResetPasswordInputSchema = z.object({
  password: PasswordSchema,
  token: z.string().min(1),
});

export type AuthResultView = {
  accessToken: string;
  user: UserView;
};

export type ForgotPasswordResultView = { cooldownSeconds?: number; status: "reset_email_sent" };

export type LogoutResultView = { status: "logged_out" };

export type RegistrationInput = z.infer<typeof RegistrationInputSchema>;

export type RegistrationResultView = {
  cooldownSeconds?: number;
  email: string;
  status: "verification_sent";
};

export type ResendVerificationInput = z.infer<typeof ResendVerificationSchema>;

export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;

export type ResetPasswordResultView = { status: "password_reset" };

export type UserView = {
  createdAt: string;
  dateOfBirth: null | string;
  email: string;
  emailVerified: boolean;
  id: string;
  name: string;
  nickname: null | string;
  role: Role;
};

const PROFILE_NAME_MIN = 2;
const PROFILE_NAME_MAX = 50;
const PROFILE_NICKNAME_MIN = 3;
const PROFILE_NICKNAME_MAX = 30;
const PROFILE_NICKNAME_PATTERN = /^[\p{L}\p{N}._-]+$/u;
const PROFILE_BIO_MAX = 300;
const PROFILE_QUOTE_MAX = 200;
const PROFILE_GENRES_MAX = 10;
const PROFILE_GENRE_MAX = 50;

const NoHtmlString = z.string().refine(noHtmlTags, "HTML tags are not allowed");

const ProfileNameSchema = z
  .string()
  .trim()
  .pipe(
    NoHtmlString.min(PROFILE_NAME_MIN, "Must be at least 2 characters long").max(
      PROFILE_NAME_MAX,
      "Must be at most 50 characters long",
    ),
  );

const ProfileNicknameSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/^@/, ""))
  .pipe(
    NoHtmlString.min(PROFILE_NICKNAME_MIN, "Nickname must be at least 3 characters long")
      .max(PROFILE_NICKNAME_MAX, "Nickname must be at most 30 characters long")
      .regex(
        PROFILE_NICKNAME_PATTERN,
        "Nickname may contain only letters, digits, dot, hyphen and underscore",
      ),
  );

const ProfileBioSchema = z
  .string()
  .trim()
  .pipe(NoHtmlString.max(PROFILE_BIO_MAX, "Bio must be at most 300 characters long"));

const ProfileQuoteSchema = z
  .string()
  .trim()
  .pipe(NoHtmlString.max(PROFILE_QUOTE_MAX, "Quote must be at most 200 characters long"));

const isNotInFuture = (value: string): boolean => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return new Date(`${value}T00:00:00.000Z`) <= today;
};

const notInFutureDate = (message: string) => z.iso.date().refine(isNotInFuture, message);

const ProfileDateOfBirthSchema = notInFutureDate("Date of birth must not be in the future");

const ProfileGenresSchema = z
  .array(
    z
      .string()
      .trim()
      .pipe(
        NoHtmlString.min(1, "Genre must not be empty").max(
          PROFILE_GENRE_MAX,
          "Genre must be at most 50 characters long",
        ),
      ),
  )
  .max(PROFILE_GENRES_MAX, "You can select at most 10 genres")
  .refine((genres) => {
    const seen = new Set(genres.map((genre) => genre.toLowerCase()));
    return seen.size === genres.length;
  }, "Genres must not contain duplicates");

export const AuthProviderSchema = z.enum(["PASSWORD", "GOOGLE", "APPLE"]);

export type AuthProvider = z.infer<typeof AuthProviderSchema>;

export const UpdateProfileInputSchema = z.object({
  bio: ProfileBioSchema.nullable().optional(),
  dateOfBirth: ProfileDateOfBirthSchema.nullable().optional(),
  favoriteBookQuote: ProfileQuoteSchema.nullable().optional(),
  favoriteGenres: ProfileGenresSchema.optional(),
  lastName: ProfileNameSchema.optional(),
  name: ProfileNameSchema.optional(),
  nickname: ProfileNicknameSchema.nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;

const SOCIAL_USERNAME_MIN = 2;
const SOCIAL_USERNAME_MAX = 50;
const SOCIAL_URL_MAX = 300;
const SOCIAL_LABEL_MAX = 40;
const SOCIAL_USERNAME_NO_SPACES = /^\S+$/;
const HTTPS_PROTOCOL = /^https$/;

export const SocialPlatformSchema = z.enum([
  "INSTAGRAM",
  "TIKTOK",
  "TWITTER",
  "THREADS",
  "YOUTUBE",
  "GOODREADS",
  "STORYGRAPH",
  "TELEGRAM",
  "WEBSITE",
  "OTHER",
]);

export type SocialPlatform = z.infer<typeof SocialPlatformSchema>;

const SocialUsernameSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/^@/, ""))
  .pipe(
    NoHtmlString.min(SOCIAL_USERNAME_MIN, "Username must be at least 2 characters long")
      .max(SOCIAL_USERNAME_MAX, "Username must be at most 50 characters long")
      .regex(SOCIAL_USERNAME_NO_SPACES, "Username must not contain spaces"),
  );

const SocialUrlSchema = z
  .string()
  .trim()
  .max(SOCIAL_URL_MAX, "URL must be at most 300 characters long")
  .refine(noHtmlTags, "HTML tags are not allowed")
  .pipe(z.url({ error: "Enter a valid https link", protocol: HTTPS_PROTOCOL }));

const SocialLabelSchema = z
  .string()
  .trim()
  .pipe(NoHtmlString.max(SOCIAL_LABEL_MAX, "Label must be at most 40 characters long"));

export const CreateSocialLinkInputSchema = z
  .object({
    label: SocialLabelSchema.optional(),
    platform: SocialPlatformSchema,
    url: SocialUrlSchema.optional(),
    username: SocialUsernameSchema.optional(),
  })
  .refine(
    (value) =>
      (value.username !== undefined && value.username.length > 0) ||
      (value.url !== undefined && value.url.length > 0),
    { error: "Add a username or a profile link", path: ["username"] },
  );

export type CreateSocialLinkInput = z.infer<typeof CreateSocialLinkInputSchema>;

export const UpdateSocialLinkInputSchema = z.object({
  label: SocialLabelSchema.nullable().optional(),
  platform: SocialPlatformSchema.optional(),
  url: SocialUrlSchema.nullable().optional(),
  username: SocialUsernameSchema.nullable().optional(),
});

export type ProfileView = {
  authProvider: AuthProvider;
  avatarUrl: null | string;
  bio: null | string;
  createdAt: string;
  dateOfBirth: null | string;
  email: string;
  emailVerified: boolean;
  favoriteBookQuote: null | string;
  favoriteGenres: string[];
  lastName: null | string;
  name: string;
  nickname: null | string;
  socialLinks: SocialLinkView[];
  updatedAt: string;
  userId: string;
};

export type SocialLinkView = {
  createdAt: string;
  id: string;
  label: null | string;
  platform: SocialPlatform;
  updatedAt: string;
  url: null | string;
  username: null | string;
};

export type UpdateSocialLinkInput = z.infer<typeof UpdateSocialLinkInputSchema>;

const TIMEZONE_MAX = 64;

export const ThemeModeSchema = z.enum(["light", "dark", "system"]);

export type ThemeMode = z.infer<typeof ThemeModeSchema>;

export const AccentColorSchema = z.enum(["brown", "orange", "yellow", "green", "blue", "purple"]);

export type AccentColor = z.infer<typeof AccentColorSchema>;

export const InterfaceLanguageSchema = z.enum(["uk", "en"]);

export type InterfaceLanguage = z.infer<typeof InterfaceLanguageSchema>;

export const DateFormatSchema = z.enum(["DD.MM.YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]);

export type DateFormat = z.infer<typeof DateFormatSchema>;

export const WeekStartDaySchema = z.enum(["monday", "sunday"]);

export type WeekStartDay = z.infer<typeof WeekStartDaySchema>;

export const LibraryViewModeSchema = z.enum(["grid", "list"]);

export type LibraryViewMode = z.infer<typeof LibraryViewModeSchema>;

export const EmailNotificationsSchema = z.object({
  borrowedBookReminders: z.boolean(),
  deliveryReminders: z.boolean(),
  monthlyReadingReport: z.boolean(),
  readingGoalReminders: z.boolean(),
  readingReminders: z.boolean(),
  weeklyReadingSummary: z.boolean(),
});

export type EmailNotifications = z.infer<typeof EmailNotificationsSchema>;

const SettingsTimezoneSchema = z
  .string()
  .trim()
  .pipe(
    NoHtmlString.min(1, "Timezone must not be empty").max(
      TIMEZONE_MAX,
      "Timezone must be at most 64 characters long",
    ),
  );

export const UpdateSettingsInputSchema = z.object({
  accentColor: AccentColorSchema.optional(),
  confirmBeforeDelete: z.boolean().optional(),
  dateFormat: DateFormatSchema.optional(),
  emailNotifications: EmailNotificationsSchema.partial().optional(),
  language: InterfaceLanguageSchema.optional(),
  libraryViewMode: LibraryViewModeSchema.optional(),
  themeMode: ThemeModeSchema.optional(),
  timezone: SettingsTimezoneSchema.optional(),
  weekStartDay: WeekStartDaySchema.optional(),
});

export type SettingsView = {
  accentColor: AccentColor;
  confirmBeforeDelete: boolean;
  dateFormat: DateFormat;
  emailNotifications: EmailNotifications;
  language: InterfaceLanguage;
  libraryViewMode: LibraryViewMode;
  themeMode: ThemeMode;
  timezone: string;
  weekStartDay: WeekStartDay;
};

export type UpdateSettingsInput = z.infer<typeof UpdateSettingsInputSchema>;

export const ReadingStatusSchema = z.enum([
  "not_started",
  "want_to_read",
  "reading",
  "paused",
  "finished",
  "dnf",
  "rereading",
]);

export type ReadingStatus = z.infer<typeof ReadingStatusSchema>;

export const OwnershipStatusSchema = z.enum([
  "none",
  "want_to_buy",
  "in_transit",
  "owned",
  "borrowed_from_someone",
  "lent_to_someone",
]);

export type OwnershipStatus = z.infer<typeof OwnershipStatusSchema>;

export const CurrencySchema = z.enum(["UAH", "EUR", "USD"]);

export type Currency = z.infer<typeof CurrencySchema>;

export const QueuePrioritySchema = z.enum(["low", "normal", "high"]);

export type QueuePriority = z.infer<typeof QueuePrioritySchema>;

export const DeliveryStatusSchema = z.enum([
  "ordered",
  "in_transit",
  "ready_for_pickup",
  "cancelled",
]);

export type DeliveryStatus = z.infer<typeof DeliveryStatusSchema>;

const BOOK_GENRES_MAX = 5;
const GENRE_KEY_MAX = 64;

export const GenreKeySchema = z.string().trim().min(1).max(GENRE_KEY_MAX);

export const BookGenresSchema = z
  .array(GenreKeySchema)
  .max(BOOK_GENRES_MAX, "You can select at most 5 genres")
  .refine((genres) => new Set(genres).size === genres.length, "Genres must not contain duplicates");

export const BookFormatSchema = z.enum(["paper", "ebook", "audiobook"]);

export type BookFormat = z.infer<typeof BookFormatSchema>;

export const BookFormatsSchema = z
  .array(BookFormatSchema)
  .refine(
    (formats) => new Set(formats).size === formats.length,
    "Formats must not contain duplicates",
  );

export const BookLanguageSchema = z.enum([
  "ukrainian",
  "english",
  "polish",
  "german",
  "french",
  "spanish",
  "other",
]);

export type BookLanguage = z.infer<typeof BookLanguageSchema>;

export const AgeCategorySchema = z.enum([
  "not_specified",
  "no_restrictions",
  "6_plus",
  "12_plus",
  "14_plus",
  "16_plus",
  "18_plus",
]);

export type AgeCategory = z.infer<typeof AgeCategorySchema>;

const BOOK_TITLE_MIN = 1;
const BOOK_TITLE_MAX = 150;
const TAXONOMY_NAME_MIN = 2;
const TAXONOMY_NAME_MAX = 100;
export const BOOK_DESCRIPTION_MAX = 5000;
export const TAG_NAME_MIN = 2;
export const TAG_NAME_MAX = 30;
const BOOK_TAGS_MAX = 12;
export const TAG_NAME_ALLOWED_CHARS = /^[\p{L}\p{N} '’-]+$/u;

const SERIES_NAME_MIN = 2;
const SERIES_NAME_MAX = 120;
const SERIES_DESCRIPTION_MAX = 300;
const SERIES_TOTAL_BOOKS_MIN = 1;
const SERIES_TOTAL_BOOKS_MAX = 999;
const BOOK_PART_NUMBER_MIN = 1;
const BOOK_PART_NUMBER_MAX = 999;

const LIST_NAME_MIN = 2;
const LIST_NAME_MAX = 80;
const LIST_DESCRIPTION_MAX = 300;
const BOOK_LIST_IDS_MAX = 50;
const BOOK_NEW_LISTS_MAX = 20;

const BOOK_PAGES_COUNT_MIN = 1;
const BOOK_PAGES_COUNT_MAX = 10000;
const BOOK_PUBLICATION_YEAR_MIN = 1000;
const BOOK_ORIGINAL_TITLE_MAX = 200;
const BOOK_CONTRIBUTOR_NAME_MAX = 100;
const BOOK_DEDICATION_MAX = 300;
const READING_CURRENT_PAGE_MIN = 0;
const READING_CURRENT_PAGE_MAX = 100000;
const READING_RATING_MIN = 1;
const READING_RATING_MAX = 5;
const READING_NOTE_MAX = 300;
const READING_IMPRESSION_MAX = 500;
const ISBN_INPUT_PATTERN = /^[0-9Xx\s-]+$/;
const ISBN_10_LENGTH = 10;
const ISBN_13_LENGTH = 13;
const ISBN_10_CHECK_MODULUS = 11;
const ISBN_10_CHECK_X_VALUE = 10;
const ISBN_13_CHECK_MODULUS = 10;
const ISBN_13_ODD_WEIGHT = 1;
const ISBN_13_EVEN_WEIGHT = 3;

export function normalizeName(name: string): string {
  return collapseSpaces(name).toLowerCase();
}

export const BookTitleSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.min(BOOK_TITLE_MIN, "Enter the book title").max(
      BOOK_TITLE_MAX,
      "Title must be at most 150 characters long",
    ),
  );

export const TaxonomyNameSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.min(TAXONOMY_NAME_MIN, "Name must be at least 2 characters long").max(
      TAXONOMY_NAME_MAX,
      "Name must be at most 100 characters long",
    ),
  );

export const CreateGenreSchema = z.object({ name: TaxonomyNameSchema });
export type CreateGenreInput = z.infer<typeof CreateGenreSchema>;

export const BookDescriptionSchema = z
  .string()
  .transform(collapseHorizontalSpaces)
  .pipe(NoHtmlString.max(BOOK_DESCRIPTION_MAX, "Description must be at most 5000 characters long"));

export const TagNameSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.min(TAG_NAME_MIN, "Tag must be at least 2 characters long")
      .max(TAG_NAME_MAX, "Tag must be at most 30 characters long")
      .regex(
        TAG_NAME_ALLOWED_CHARS,
        "Tag may contain only letters, digits, spaces, hyphens and apostrophes",
      ),
  );

export const BookTagsInputSchema = z
  .array(TagNameSchema)
  .max(BOOK_TAGS_MAX, "You can add at most 12 tags")
  .refine((tags) => {
    const seen = new Set(tags.map(normalizeName));
    return seen.size === tags.length;
  }, "Tags must not contain duplicates");

const normalizeIsbn = (value: string): string => value.replace(/[\s-]/g, "").toUpperCase();

const isValidIsbn10 = (digits: string): boolean => {
  let sum = 0;
  for (let position = 0; position < ISBN_10_LENGTH; position += 1) {
    const character = digits[position] ?? "";
    if (position === ISBN_10_LENGTH - 1 && character === "X") {
      sum += ISBN_10_CHECK_X_VALUE * (ISBN_10_LENGTH - position);
      continue;
    }
    if (character < "0" || character > "9") {
      return false;
    }
    sum += Number(character) * (ISBN_10_LENGTH - position);
  }
  return sum % ISBN_10_CHECK_MODULUS === 0;
};

const isValidIsbn13 = (digits: string): boolean => {
  if (!/^\d{13}$/.test(digits)) {
    return false;
  }
  let sum = 0;
  for (let position = 0; position < ISBN_13_LENGTH; position += 1) {
    const weight = position % 2 === 0 ? ISBN_13_ODD_WEIGHT : ISBN_13_EVEN_WEIGHT;
    sum += Number(digits[position]) * weight;
  }
  return sum % ISBN_13_CHECK_MODULUS === 0;
};

export const isValidIsbn = (value: string): boolean => {
  const normalized = normalizeIsbn(value);
  if (normalized.length === ISBN_10_LENGTH) {
    return isValidIsbn10(normalized);
  }
  if (normalized.length === ISBN_13_LENGTH) {
    return isValidIsbn13(normalized);
  }
  return false;
};

export const BookPagesCountSchema = z
  .number()
  .int()
  .min(BOOK_PAGES_COUNT_MIN, "Pages must be greater than 0")
  .max(BOOK_PAGES_COUNT_MAX, "Pages must be at most 10000");

export const BookPublicationYearSchema = z
  .number()
  .int()
  .min(BOOK_PUBLICATION_YEAR_MIN, "Enter a valid publication year")
  .max(new Date().getUTCFullYear() + 1, "Enter a valid publication year");

export const IsbnSchema = z
  .string()
  .trim()
  .refine(noHtmlTags, "HTML tags are not allowed")
  .refine((value) => ISBN_INPUT_PATTERN.test(value), "Enter a valid ISBN-10 or ISBN-13")
  .refine(isValidIsbn, "Enter a valid ISBN-10 or ISBN-13");

export const OriginalTitleSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.max(BOOK_ORIGINAL_TITLE_MAX, "Original title must be at most 200 characters long"),
  );

export const TranslatorSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.max(BOOK_CONTRIBUTOR_NAME_MAX, "Translator must be at most 100 characters long"),
  );

export const IllustratorSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.max(BOOK_CONTRIBUTOR_NAME_MAX, "Illustrator must be at most 100 characters long"),
  );

export const DedicationSchema = z
  .string()
  .transform(collapseHorizontalSpaces)
  .pipe(NoHtmlString.max(BOOK_DEDICATION_MAX, "Dedication must be at most 300 characters long"));

export const ReadingNoteSchema = z
  .string()
  .transform(collapseHorizontalSpaces)
  .pipe(NoHtmlString.max(READING_NOTE_MAX, "Note must be at most 300 characters long"));

export const ReadingImpressionSchema = z
  .string()
  .transform(collapseHorizontalSpaces)
  .pipe(NoHtmlString.max(READING_IMPRESSION_MAX, "Impression must be at most 500 characters long"));

export const ReadingProgressInputSchema = z
  .object({
    abandonedAt: notInFutureDate("Abandoned date must not be in the future").nullable().optional(),
    currentPage: z
      .number()
      .int()
      .min(READING_CURRENT_PAGE_MIN)
      .max(READING_CURRENT_PAGE_MAX)
      .nullable()
      .optional(),
    finishedAt: notInFutureDate("Finished date must not be in the future").nullable().optional(),
    impression: ReadingImpressionSchema.nullable().optional(),
    note: ReadingNoteSchema.nullable().optional(),
    pausedAt: notInFutureDate("Paused date must not be in the future").nullable().optional(),
    rating: z
      .number()
      .int()
      .min(READING_RATING_MIN, "Rating must be from 1 to 5")
      .max(READING_RATING_MAX, "Rating must be from 1 to 5")
      .nullable()
      .optional(),
    startedAt: notInFutureDate("Start date must not be in the future").nullable().optional(),
  })
  .optional();

const OWNERSHIP_STORE_NAME_MAX = 100;
const OWNERSHIP_STORE_URL_MAX = 300;
const OWNERSHIP_ORDER_NUMBER_MAX = 100;
const OWNERSHIP_NOTE_MAX = 300;
const OWNERSHIP_PERSON_NAME_MIN = 2;
const OWNERSHIP_PERSON_NAME_MAX = 100;
const OWNERSHIP_PRICE_MIN = 0;

const OwnershipStoreNameSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.max(OWNERSHIP_STORE_NAME_MAX, "Store name must be at most 100 characters long"),
  );

const OwnershipStoreUrlSchema = z
  .string()
  .trim()
  .max(OWNERSHIP_STORE_URL_MAX, "URL must be at most 300 characters long")
  .refine(noHtmlTags, "HTML tags are not allowed")
  .pipe(z.url({ error: "Enter a valid https link", protocol: HTTPS_PROTOCOL }));

const OwnershipOrderNumberSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.max(
      OWNERSHIP_ORDER_NUMBER_MAX,
      "Order number must be at most 100 characters long",
    ),
  );

const OwnershipNoteSchema = z
  .string()
  .transform(collapseHorizontalSpaces)
  .pipe(NoHtmlString.max(OWNERSHIP_NOTE_MAX, "Note must be at most 300 characters long"));

const OwnershipPersonNameSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.min(OWNERSHIP_PERSON_NAME_MIN, "Name must be at least 2 characters long").max(
      OWNERSHIP_PERSON_NAME_MAX,
      "Name must be at most 100 characters long",
    ),
  );

const OwnershipPriceSchema = z.number().min(OWNERSHIP_PRICE_MIN, "Price must be at least 0");

export const PurchaseInfoInputSchema = z
  .object({
    currency: CurrencySchema.nullable().optional(),
    expectedPrice: OwnershipPriceSchema.nullable().optional(),
    note: OwnershipNoteSchema.nullable().optional(),
    storeName: OwnershipStoreNameSchema.nullable().optional(),
    storeUrl: OwnershipStoreUrlSchema.nullable().optional(),
  })
  .optional();

export type PurchaseInfoInput = z.infer<typeof PurchaseInfoInputSchema>;

export const DeliveryInfoInputSchema = z
  .object({
    deliveryStatus: DeliveryStatusSchema.optional(),
    expectedDeliveryDate: z.iso.date().nullable().optional(),
    note: OwnershipNoteSchema.nullable().optional(),
    orderDate: notInFutureDate("Order date must not be in the future").nullable().optional(),
    orderNumber: OwnershipOrderNumberSchema.nullable().optional(),
    storeName: OwnershipStoreNameSchema.nullable().optional(),
  })
  .refine(
    (value) =>
      value.orderDate === undefined ||
      value.orderDate === null ||
      value.expectedDeliveryDate === undefined ||
      value.expectedDeliveryDate === null ||
      value.expectedDeliveryDate >= value.orderDate,
    {
      error: "Expected delivery cannot be before the order date",
      path: ["expectedDeliveryDate"],
    },
  )
  .optional();

export type DeliveryInfoInput = z.infer<typeof DeliveryInfoInputSchema>;

export const LoanInfoInputSchema = z
  .object({
    expectedReturnDate: z.iso.date().nullable().optional(),
    loanDate: notInFutureDate("Loan date must not be in the future").nullable().optional(),
    note: OwnershipNoteSchema.nullable().optional(),
    personName: OwnershipPersonNameSchema.optional(),
  })
  .refine(
    (value) =>
      value.loanDate === undefined ||
      value.loanDate === null ||
      value.expectedReturnDate === undefined ||
      value.expectedReturnDate === null ||
      value.expectedReturnDate >= value.loanDate,
    {
      error: "Expected return cannot be before the loan date",
      path: ["expectedReturnDate"],
    },
  )
  .optional();

export type LoanInfoInput = z.infer<typeof LoanInfoInputSchema>;

export const SeriesStatusSchema = z.enum(["completed", "ongoing", "unknown"]);

export type SeriesStatus = z.infer<typeof SeriesStatusSchema>;

export const BookTypeSchema = z.enum(["solo", "series_part"]);

export type BookType = z.infer<typeof BookTypeSchema>;

export const SeriesNameSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.min(SERIES_NAME_MIN, "Series name must be at least 2 characters long").max(
      SERIES_NAME_MAX,
      "Series name must be at most 120 characters long",
    ),
  );

const SeriesDescriptionSchema = z
  .string()
  .transform(collapseHorizontalSpaces)
  .pipe(
    NoHtmlString.max(SERIES_DESCRIPTION_MAX, "Description must be at most 300 characters long"),
  );

const SeriesTotalBooksSchema = z
  .number()
  .int()
  .min(SERIES_TOTAL_BOOKS_MIN, "Total books must be at least 1")
  .max(SERIES_TOTAL_BOOKS_MAX, "Total books must be at most 999");

const BookPartNumberSchema = z
  .number()
  .int()
  .min(BOOK_PART_NUMBER_MIN, "Part number must be from 1 to 999")
  .max(BOOK_PART_NUMBER_MAX, "Part number must be from 1 to 999");

export const NewSeriesInputSchema = z.object({
  description: SeriesDescriptionSchema.optional(),
  name: SeriesNameSchema,
  status: SeriesStatusSchema.default("unknown"),
  totalBooks: SeriesTotalBooksSchema.optional(),
});

export type NewSeriesInput = z.infer<typeof NewSeriesInputSchema>;

const OWNERSHIP_STATUSES_WITH_LOAN: ReadonlySet<OwnershipStatus> = new Set<OwnershipStatus>([
  "borrowed_from_someone",
  "lent_to_someone",
]);

export function ownershipStatusUsesLoan(ownershipStatus: OwnershipStatus): boolean {
  return OWNERSHIP_STATUSES_WITH_LOAN.has(ownershipStatus);
}

export const ListNameSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.min(LIST_NAME_MIN, "List name must be at least 2 characters long").max(
      LIST_NAME_MAX,
      "List name must be at most 80 characters long",
    ),
  );

export const ListDescriptionSchema = z
  .string()
  .transform(collapseHorizontalSpaces)
  .pipe(NoHtmlString.max(LIST_DESCRIPTION_MAX, "Description must be at most 300 characters long"));

export const NewListInputSchema = z.object({
  description: ListDescriptionSchema.optional(),
  name: ListNameSchema,
});

export type BookListView = {
  description: null | string;
  id: string;
  name: string;
};

export type NewListInput = z.infer<typeof NewListInputSchema>;

export const OPEN_LIBRARY_AUTHOR_KEY_PATTERN = /^OL\d+A$/;

export const OpenLibraryAuthorKeySchema = z
  .string()
  .trim()
  .regex(OPEN_LIBRARY_AUTHOR_KEY_PATTERN, "Enter a valid Open Library author key");

export const BookAuthorReferenceSchema = z.union([
  z.strictObject({ id: z.uuid() }),
  z.strictObject({ openLibraryKey: OpenLibraryAuthorKeySchema }),
  z.strictObject({ name: TaxonomyNameSchema }),
]);

export type BookAuthorReference = z.infer<typeof BookAuthorReferenceSchema>;

export const CreateBookInputSchema = z
  .object({
    addToReadingQueue: z.boolean().default(false),
    ageCategory: AgeCategorySchema.default("not_specified"),
    author: BookAuthorReferenceSchema,
    bookType: BookTypeSchema.default("solo"),
    coverMediaId: z.uuid().nullable().optional(),
    dedication: DedicationSchema.nullable().optional(),
    deliveryInfo: DeliveryInfoInputSchema,
    description: BookDescriptionSchema.nullable().optional(),
    formats: BookFormatsSchema.default([]),
    genres: BookGenresSchema.default([]),
    illustrator: IllustratorSchema.nullable().optional(),
    isbn: IsbnSchema.nullable().optional(),
    isFavorite: z.boolean().default(false),
    language: BookLanguageSchema.default("ukrainian"),
    listIds: z.array(z.uuid()).max(BOOK_LIST_IDS_MAX).optional(),
    loanInfo: LoanInfoInputSchema,
    newLists: z.array(NewListInputSchema).max(BOOK_NEW_LISTS_MAX).optional(),
    newSeries: NewSeriesInputSchema.optional(),
    originalTitle: OriginalTitleSchema.nullable().optional(),
    ownershipStatus: OwnershipStatusSchema.default("none"),
    pagesCount: BookPagesCountSchema.nullable().optional(),
    partNumber: BookPartNumberSchema.optional(),
    publicationYear: BookPublicationYearSchema.nullable().optional(),
    publisherId: z.uuid().optional(),
    publisherName: TaxonomyNameSchema.optional(),
    purchaseInfo: PurchaseInfoInputSchema,
    queuePriority: QueuePrioritySchema.optional(),
    readingProgress: ReadingProgressInputSchema,
    readingStatus: ReadingStatusSchema.default("not_started"),
    seriesId: z.uuid().optional(),
    tags: BookTagsInputSchema.default([]),
    title: BookTitleSchema,
    translator: TranslatorSchema.nullable().optional(),
  })
  .refine((value) => !(value.publisherId !== undefined && value.publisherName !== undefined), {
    error: "Provide either an existing publisher or a custom publisher name",
    path: ["publisherName"],
  })
  .superRefine((value, context) => {
    const currentPage = value.readingProgress?.currentPage;
    const pagesCount = value.pagesCount;
    if (
      currentPage !== undefined &&
      currentPage !== null &&
      pagesCount !== undefined &&
      pagesCount !== null &&
      currentPage > pagesCount
    ) {
      context.addIssue({
        code: "custom",
        message: "Current page cannot exceed the page count",
        path: ["readingProgress", "currentPage"],
      });
    }

    if (
      ownershipStatusUsesLoan(value.ownershipStatus) &&
      (value.loanInfo?.personName ?? "").length === 0
    ) {
      context.addIssue({
        code: "custom",
        message: "Enter the person's name",
        path: ["loanInfo", "personName"],
      });
    }

    if (value.bookType === "series_part") {
      const hasExistingSeries = value.seriesId !== undefined;
      const hasNewSeries = value.newSeries !== undefined;
      if (hasExistingSeries === hasNewSeries) {
        context.addIssue({
          code: "custom",
          message: "Choose an existing series or create a new one",
          path: ["newSeries"],
        });
      }

      if (value.partNumber === undefined) {
        context.addIssue({
          code: "custom",
          message: "Enter the part number",
          path: ["partNumber"],
        });
      }

      const totalBooks = value.newSeries?.totalBooks;
      if (
        totalBooks !== undefined &&
        value.partNumber !== undefined &&
        totalBooks < value.partNumber
      ) {
        context.addIssue({
          code: "custom",
          message: "Total books cannot be fewer than the part number",
          path: ["newSeries", "totalBooks"],
        });
      }
    }
  });

export const UpdateBookInputSchema = z
  .object({
    addToReadingQueue: z.boolean().optional(),
    ageCategory: AgeCategorySchema.optional(),
    author: BookAuthorReferenceSchema.optional(),
    bookType: BookTypeSchema.optional(),
    coverMediaId: z.uuid().nullable().optional(),
    dedication: DedicationSchema.nullable().optional(),
    deliveryInfo: DeliveryInfoInputSchema,
    description: BookDescriptionSchema.nullable().optional(),
    formats: BookFormatsSchema.optional(),
    genres: BookGenresSchema.optional(),
    illustrator: IllustratorSchema.nullable().optional(),
    isbn: IsbnSchema.nullable().optional(),
    isFavorite: z.boolean().optional(),
    language: BookLanguageSchema.optional(),
    listIds: z.array(z.uuid()).max(BOOK_LIST_IDS_MAX).optional(),
    loanInfo: LoanInfoInputSchema,
    newLists: z.array(NewListInputSchema).max(BOOK_NEW_LISTS_MAX).optional(),
    newSeries: NewSeriesInputSchema.optional(),
    originalTitle: OriginalTitleSchema.nullable().optional(),
    ownershipStatus: OwnershipStatusSchema.optional(),
    pagesCount: BookPagesCountSchema.nullable().optional(),
    partNumber: BookPartNumberSchema.optional(),
    publicationYear: BookPublicationYearSchema.nullable().optional(),
    publisherId: z.uuid().optional(),
    publisherName: TaxonomyNameSchema.optional(),
    purchaseInfo: PurchaseInfoInputSchema,
    queuePriority: QueuePrioritySchema.optional(),
    readingProgress: ReadingProgressInputSchema,
    readingStatus: ReadingStatusSchema.optional(),
    seriesId: z.uuid().optional(),
    tags: BookTagsInputSchema.optional(),
    title: BookTitleSchema.optional(),
    translator: TranslatorSchema.nullable().optional(),
  })
  .refine((value) => !(value.publisherId !== undefined && value.publisherName !== undefined), {
    error: "Provide either an existing publisher or a custom publisher name",
    path: ["publisherName"],
  })
  .superRefine((value, context) => {
    const currentPage = value.readingProgress?.currentPage;
    const pagesCount = value.pagesCount;
    if (
      currentPage !== undefined &&
      currentPage !== null &&
      pagesCount !== undefined &&
      pagesCount !== null &&
      currentPage > pagesCount
    ) {
      context.addIssue({
        code: "custom",
        message: "Current page cannot exceed the page count",
        path: ["readingProgress", "currentPage"],
      });
    }

    if (value.bookType === "series_part") {
      const hasExistingSeries = value.seriesId !== undefined;
      const hasNewSeries = value.newSeries !== undefined;
      if (hasExistingSeries === hasNewSeries) {
        context.addIssue({
          code: "custom",
          message: "Choose an existing series or create a new one",
          path: ["newSeries"],
        });
      }

      if (value.partNumber === undefined) {
        context.addIssue({
          code: "custom",
          message: "Enter the part number",
          path: ["partNumber"],
        });
      }

      const totalBooks = value.newSeries?.totalBooks;
      if (
        totalBooks !== undefined &&
        value.partNumber !== undefined &&
        totalBooks < value.partNumber
      ) {
        context.addIssue({
          code: "custom",
          message: "Total books cannot be fewer than the part number",
          path: ["newSeries", "totalBooks"],
        });
      }
    }
  });

export type AuthorView = {
  bio: null | string;
  birthYear: null | number;
  countryCode: null | string;
  deathYear: null | number;
  id: string;
  isCustom: boolean;
  name: string;
  openLibraryKey: null | string;
  photoAttribution: null | string;
  photoLicense: null | string;
  photoLicenseUrl: null | string;
  photoUrl: null | string;
};

export type UpdateBookInput = z.infer<typeof UpdateBookInputSchema>;

export const AuthorLookupResultSchema = z.object({
  birthYear: z.number().int().nullable(),
  inDb: z.boolean(),
  name: z.string(),
  openLibraryKey: z.string(),
  photoUrl: z.string().nullable(),
  source: z.literal("open_library"),
});

export type AuthorLookupResult = z.infer<typeof AuthorLookupResultSchema>;

const AUTHOR_LOOKUP_QUERY_MIN = 2;
const AUTHOR_LOOKUP_QUERY_MAX = 100;

export const AuthorLookupQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(AUTHOR_LOOKUP_QUERY_MIN, "Search query must be at least 2 characters long")
    .max(AUTHOR_LOOKUP_QUERY_MAX, "Search query must be at most 100 characters long"),
});

export type AuthorBookSuggestionView = {
  coverUrl: null | string;
  firstPublishYear: null | number;
  openLibraryWorkKey: string;
  title: string;
};

export type AuthorLookupQuery = z.infer<typeof AuthorLookupQuerySchema>;

export type BookView = {
  ageCategory: AgeCategory;
  author: { id: string; name: string };
  bookType: BookType;
  cover?: MediaView | null;
  createdAt: string;
  dedication: null | string;
  deliveryInfo: DeliveryInfoView | null;
  description: null | string;
  formats: BookFormat[];
  genres: string[];
  id: string;
  illustrator: null | string;
  isbn: null | string;
  isFavorite: boolean;
  isInReadingQueue: boolean;
  language: BookLanguage;
  lists: BookListView[];
  loanInfo: LoanInfoView | null;
  originalTitle: null | string;
  ownershipStatus: OwnershipStatus;
  pagesCount: null | number;
  partNumber: null | number;
  publicationYear: null | number;
  publisher: null | { id: string; name: string };
  purchaseInfo: null | PurchaseInfoView;
  queuePriority: null | QueuePriority;
  readingProgress: null | ReadingProgressView;
  readingStatus: ReadingStatus;
  series: null | SeriesView;
  tags: TagView[];
  title: string;
  translator: null | string;
  updatedAt: string;
  userId: string;
};

export type CreateBookInput = z.infer<typeof CreateBookInputSchema>;

export type DeliveryInfoView = {
  deliveryStatus: DeliveryStatus | null;
  expectedDeliveryDate: null | string;
  note: null | string;
  orderDate: null | string;
  orderNumber: null | string;
  storeName: null | string;
};

export type GenreView = {
  groupKey: string;
  groupName: string;
  id: string;
  isDefault: boolean;
  key: string;
  name: string;
};

export type LoanInfoView = {
  expectedReturnDate: null | string;
  loanDate: null | string;
  note: null | string;
  personName: string;
};

export const MEDIA_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MEDIA_MAX_UPLOAD_MB = MEDIA_MAX_UPLOAD_BYTES / (1024 * 1024);

export const MEDIA_DERIVATIVES = ["thumb", "card", "full"] as const;
export type MediaDerivative = (typeof MEDIA_DERIVATIVES)[number];

export const MediaKindSchema = z.enum(["avatar", "book_cover", "series_cover"]);
export type MediaKind = z.infer<typeof MediaKindSchema>;

export const MediaCropSchema = z.object({
  height: z.number().int().positive(),
  width: z.number().int().positive(),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
});

export type MediaCrop = z.infer<typeof MediaCropSchema>;

const parseCropJson = (value: unknown): unknown => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
};

export const MediaUploadInputSchema = z.object({
  crop: z.preprocess(parseCropJson, MediaCropSchema).optional(),
  kind: MediaKindSchema.default("book_cover"),
});

export type MediaUploadInput = z.infer<typeof MediaUploadInputSchema>;

export const MediaViewSchema = z.object({
  contentType: z.string(),
  createdAt: z.string(),
  height: z.number(),
  id: z.string(),
  kind: MediaKindSchema,
  name: z.string().nullable(),
  sizeBytes: z.number(),
  urls: z.object({
    card: z.string(),
    full: z.string(),
    thumb: z.string(),
  }),
  width: z.number(),
});

export type MediaView = z.infer<typeof MediaViewSchema>;

export type PublisherView = {
  countryCode: null | string;
  foundedYear: null | number;
  id: string;
  isCustom: boolean;
  logoAttribution: null | string;
  logoLicense: null | string;
  logoLicenseUrl: null | string;
  logoUrl: null | string;
  name: string;
  websiteUrl: null | string;
};

export type PurchaseInfoView = {
  currency: Currency | null;
  expectedPrice: null | number;
  note: null | string;
  storeName: null | string;
  storeUrl: null | string;
};

export type ReadingProgressInput = z.infer<typeof ReadingProgressInputSchema>;

export type ReadingProgressView = {
  abandonedAt: null | string;
  currentPage: null | number;
  finishedAt: null | string;
  impression: null | string;
  note: null | string;
  pausedAt: null | string;
  rating: null | number;
  startedAt: null | string;
};

export type SeriesView = {
  booksInSeries: number;
  description: null | string;
  finishedInSeries: number;
  id: string;
  name: string;
  status: SeriesStatus;
  totalBooks: null | number;
};

export type TagView = {
  id: string;
  name: string;
};

export const TaxonomySearchPaginationQuerySchema = z.object({
  pageNumber: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(LIST_PAGE_SIZE_MAX).default(10),
  search: z.string().trim().max(TAXONOMY_NAME_MAX).optional(),
});

export type TaxonomySearchPaginationQuery = z.infer<typeof TaxonomySearchPaginationQuerySchema>;

export const CatalogLocaleSchema = z.enum(["en", "uk"]);

export type CatalogLocale = z.infer<typeof CatalogLocaleSchema>;

export const AuthorSearchPaginationQuerySchema = TaxonomySearchPaginationQuerySchema.extend({
  locale: CatalogLocaleSchema.default("uk"),
});

export type AuthorSearchPaginationQuery = z.infer<typeof AuthorSearchPaginationQuerySchema>;

export const PublisherSearchPaginationQuerySchema = TaxonomySearchPaginationQuerySchema.extend({
  locale: CatalogLocaleSchema.default("uk"),
});

export type PublisherSearchPaginationQuery = z.infer<typeof PublisherSearchPaginationQuerySchema>;

export const defaultUserProfileSettings: SettingsView = {
  accentColor: "brown",
  confirmBeforeDelete: true,
  dateFormat: "DD.MM.YYYY",
  emailNotifications: {
    borrowedBookReminders: true,
    deliveryReminders: true,
    monthlyReadingReport: false,
    readingGoalReminders: false,
    readingReminders: false,
    weeklyReadingSummary: false,
  },
  language: "uk",
  libraryViewMode: "grid",
  themeMode: "system",
  timezone: "Europe/Kyiv",
  weekStartDay: "monday",
};
