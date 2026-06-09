-- CreateTable
CREATE TABLE "user_profile_settings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "theme_mode" TEXT NOT NULL DEFAULT 'system',
    "accent_color" TEXT NOT NULL DEFAULT 'brown',
    "language" TEXT NOT NULL DEFAULT 'uk',
    "date_format" TEXT NOT NULL DEFAULT 'DD.MM.YYYY',
    "week_start_day" TEXT NOT NULL DEFAULT 'monday',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Kyiv',
    "library_view_mode" TEXT NOT NULL DEFAULT 'grid',
    "confirm_before_delete" BOOLEAN NOT NULL DEFAULT true,
    "reading_reminders" BOOLEAN NOT NULL DEFAULT false,
    "reading_goal_reminders" BOOLEAN NOT NULL DEFAULT false,
    "borrowed_book_reminders" BOOLEAN NOT NULL DEFAULT true,
    "delivery_reminders" BOOLEAN NOT NULL DEFAULT true,
    "weekly_reading_summary" BOOLEAN NOT NULL DEFAULT false,
    "monthly_reading_report" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_profile_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profile_settings_user_id_key" ON "user_profile_settings"("user_id");

-- AddForeignKey
ALTER TABLE "user_profile_settings" ADD CONSTRAINT "user_profile_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
