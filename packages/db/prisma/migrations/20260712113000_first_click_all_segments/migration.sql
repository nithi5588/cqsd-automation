-- AlterEnum
ALTER TYPE "SegmentType" ADD VALUE 'ALL';

-- AlterTable
ALTER TABLE "contact_campaign_activity" ADD COLUMN "first_click_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN "bounced_at" TIMESTAMP(3);
