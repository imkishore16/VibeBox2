/*
  Warnings:

  - The values [Spotify,Youtube] on the enum `StreamType` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `platform` to the `Stream` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('YOUTUBE', 'SPOTIFY');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('PRIORITY_BOOST', 'SYSTEM_GRANT', 'REWARD');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Provider" ADD VALUE 'Credentials';
ALTER TYPE "Provider" ADD VALUE 'Spotify';

-- AlterEnum
BEGIN;
CREATE TYPE "StreamType_new" AS ENUM ('VIDEO', 'AUDIO');
ALTER TABLE "Stream" ALTER COLUMN "type" TYPE "StreamType_new" USING ("type"::text::"StreamType_new");
ALTER TYPE "StreamType" RENAME TO "StreamType_old";
ALTER TYPE "StreamType_new" RENAME TO "StreamType";
DROP TYPE "StreamType_old";
COMMIT;

-- AlterTable
ALTER TABLE "Stream" ADD COLUMN     "albumCover" TEXT,
ADD COLUMN     "artist" TEXT,
ADD COLUMN     "paidAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "platform" "Platform" NOT NULL,
ALTER COLUMN "bigImg" DROP NOT NULL,
ALTER COLUMN "bigImg" DROP DEFAULT,
ALTER COLUMN "smallImg" DROP NOT NULL,
ALTER COLUMN "smallImg" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "name" TEXT,
ADD COLUMN     "password" TEXT,
ADD COLUMN     "tokens" INTEGER NOT NULL DEFAULT 100;

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "TransactionType" NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
