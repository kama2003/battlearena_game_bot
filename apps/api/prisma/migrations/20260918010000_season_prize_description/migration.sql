-- AlterTable
ALTER TABLE "Season" DROP COLUMN "prizeFund",
DROP COLUMN "prizeCurrency",
ADD COLUMN "prizeDescription" TEXT NOT NULL DEFAULT '10 000 ₽';
