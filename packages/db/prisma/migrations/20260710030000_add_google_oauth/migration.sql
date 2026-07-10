-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email" TEXT,
ADD COLUMN     "google_id" TEXT,
ALTER COLUMN "phone" DROP NOT NULL;
-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");
