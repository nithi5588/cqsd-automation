-- AlterEnum
ALTER TYPE "SegmentType" ADD VALUE 'CC_SEGMENT';

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "custom_fields" JSONB,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
