import "../../src/lib/loadRootEnv";
import { faker } from "@faker-js/faker";
import { PrismaClient } from "@prisma/client";
import { GAME_BALANCE } from "@battle/config";

const prisma = new PrismaClient();

const FAKE_USER_COUNT = 50;

function randomReferralCode(): string {
  return faker.string.alpha({ length: 8, casing: "upper" });
}

async function main() {
  console.log("Seeding database...");

  const season = await prisma.season.upsert({
    where: { number: 1 },
    create: {
      number: 1,
      name: "Сезон #1",
      startsAt: new Date(),
      endsAt: new Date(Date.now() + GAME_BALANCE.seasonDurationDays * 24 * 60 * 60 * 1000),
      prizeFund: GAME_BALANCE.defaultPrizeFund,
      prizeCurrency: GAME_BALANCE.defaultPrizeCurrency,
      isActive: true,
    },
    update: {},
  });

  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  for (let i = 0; i < FAKE_USER_COUNT; i++) {
    const telegramId = `fake_${1_000_000 + i}`;
    const firstName = faker.person.firstName();
    const username = faker.internet.username().toLowerCase();

    const user = await prisma.user.upsert({
      where: { telegramId },
      create: {
        telegramId,
        firstName,
        username,
        photoUrl: faker.image.avatar(),
        referralCode: randomReferralCode(),
        createdAt: faker.date.past({ years: 1 }),
      },
      update: {},
    });

    const gamesPlayed = faker.number.int({ min: 1, max: 25 });
    let bestScore = 0;
    let totalScore = 0;

    for (let g = 0; g < gamesPlayed; g++) {
      const score = faker.number.int({ min: 20, max: 118 });
      bestScore = Math.max(bestScore, score);
      totalScore += score;

      // Spread rounds across the last 10 days so day/week/season leaderboards
      // all have realistic, non-identical data.
      const createdAt = new Date(now - faker.number.int({ min: 0, max: 10 }) * oneDayMs);

      const session = await prisma.gameSession.create({
        data: {
          userId: user.id,
          status: "FINISHED",
          startedAt: createdAt,
          expiresAt: new Date(createdAt.getTime() + GAME_BALANCE.gameSessionTtlSeconds * 1000),
          finishedAt: createdAt,
          createdAt,
        },
      });

      await prisma.gameResult.create({
        data: {
          userId: user.id,
          gameSessionId: session.id,
          score,
          seasonId: season.id,
          createdAt,
        },
      });
    }

    await prisma.seasonScore.upsert({
      where: { userId_seasonId: { userId: user.id, seasonId: season.id } },
      create: { userId: user.id, seasonId: season.id, bestScore, totalScore, gamesPlayed },
      update: { bestScore, totalScore, gamesPlayed },
    });
  }

  console.log(`Seeded ${FAKE_USER_COUNT} fake users into ${season.name}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
