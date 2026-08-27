SET LOCAL lock_timeout = '3s';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_changed_at" TIMESTAMPTZ;
