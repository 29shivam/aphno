-- CreateEnum
CREATE TYPE "GroupKind" AS ENUM ('GROUP', 'DIRECT');

-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "kind" "GroupKind" NOT NULL DEFAULT 'GROUP';
