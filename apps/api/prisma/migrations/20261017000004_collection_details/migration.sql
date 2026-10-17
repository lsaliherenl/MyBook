-- CreateEnum
CREATE TYPE "CollectionKind" AS ENUM ('COURSE', 'LITERATURE', 'SCIENCE', 'NEW', 'SPECIAL');

-- AlterTable
ALTER TABLE "collections" ADD COLUMN     "curator_en" TEXT,
ADD COLUMN     "curator_tr" TEXT,
ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kind" "CollectionKind" NOT NULL DEFAULT 'LITERATURE';

