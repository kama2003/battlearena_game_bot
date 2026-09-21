-- AlterTable
ALTER TABLE "SeasonScore"
  ADD COLUMN "roundBest" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bonusPoints" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bonusUpdatedAt" TIMESTAMP(3);

-- Backfill: split each existing bestScore into what was actually played and
-- what an admin added on top, so nothing changes for anyone on the season board.
UPDATE "SeasonScore" ss
SET "roundBest" = COALESCE(
  (SELECT MAX(gr."score") FROM "GameResult" gr
   WHERE gr."userId" = ss."userId" AND gr."seasonId" = ss."seasonId"),
  0
);
UPDATE "SeasonScore" SET "bonusPoints" = "bestScore" - "roundBest";
UPDATE "SeasonScore" SET "bonusUpdatedAt" = "updatedAt" WHERE "bonusPoints" <> 0;
