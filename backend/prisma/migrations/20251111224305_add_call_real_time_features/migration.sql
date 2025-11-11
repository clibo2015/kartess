-- AlterTable
ALTER TABLE "call_sessions" ADD COLUMN     "answered_at" TIMESTAMP(3),
ADD COLUMN     "call_status" TEXT,
ADD COLUMN     "thread_id" TEXT,
ADD COLUMN     "viewers_count" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "call_sessions_call_status_idx" ON "call_sessions"("call_status");

-- CreateIndex
CREATE INDEX "call_sessions_thread_id_idx" ON "call_sessions"("thread_id");
