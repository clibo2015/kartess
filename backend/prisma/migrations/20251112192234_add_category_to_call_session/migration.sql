-- AlterTable
ALTER TABLE "call_sessions" ADD COLUMN     "category" TEXT;

-- CreateIndex
CREATE INDEX "call_sessions_category_idx" ON "call_sessions"("category");
