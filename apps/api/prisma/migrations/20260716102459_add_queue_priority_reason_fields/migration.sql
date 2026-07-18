-- AlterTable
ALTER TABLE "books" ADD COLUMN     "queue_priority_reason" TEXT,
ADD COLUMN     "queue_priority_reason_custom_text" TEXT,
ADD COLUMN     "queue_priority_target_date" DATE;
