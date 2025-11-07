-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "receiver_preset" TEXT,
ADD COLUMN     "sender_preset" TEXT;

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "network_type" TEXT NOT NULL DEFAULT 'both';

-- CreateIndex
CREATE INDEX "posts_network_type_idx" ON "posts"("network_type");
