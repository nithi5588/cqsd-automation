-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "from_name" TEXT,
ADD COLUMN     "from_email" TEXT,
ADD COLUMN     "reply_to" TEXT,
ADD COLUMN     "html_content" TEXT,
ADD COLUMN     "segment_id" TEXT;

-- CreateIndex
CREATE INDEX "campaigns_segment_id_idx" ON "campaigns"("segment_id");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
