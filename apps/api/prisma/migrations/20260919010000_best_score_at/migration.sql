-- AlterTable
ALTER TABLE "SeasonScore" ADD COLUMN "bestScoreAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: the moment each existing player first reached their current best.
UPDATE "SeasonScore" ss
SET "bestScoreAt" = COALESCE(
  (SELECT MIN(gr."createdAt") FROM "GameResult" gr
   WHERE gr."userId" = ss."userId" AND gr."seasonId" = ss."seasonId" AND gr."score" = ss."bestScore"),
  ss."bestScoreAt"
);
