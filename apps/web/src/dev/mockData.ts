import type {
  ChallengeResponse,
  GameAttemptsResponse,
  GameFinishResponse,
  GameStartResponse,
  LeaderboardEntryDto,
  LeaderboardResponse,
  MeResponse,
  ProfileResponse,
  ReferralsResponse,
  SeasonResponse,
  SubscriptionStatusResponse,
  TasksResponse,
  TelegramAuthResponse,
  UserDto,
} from "@battle/types";

/**
 * Fixture data for `?mock=1` design-QA mode (see enableMocks.ts). Dev-only —
 * never bundled into a production build since every call site is gated by
 * import.meta.env.DEV, which Vite statically strips.
 */

const NAMES = [
  "Максим", "Даша", "Алексей", "Виктор", "Лиза", "Сергей", "Мария", "Олег",
  "Настя", "Кирилл", "Юля", "Игорь", "Полина", "Артём", "Соня",
];

export const mockUser: UserDto = {
  id: "user-me",
  telegramId: "111111",
  username: "kamill",
  firstName: "Камилл",
  lastName: null,
  photoUrl: null,
  referralCode: "KAMILL123",
  createdAt: "2026-06-12T10:00:00.000Z",
};

export const mockSubscriptionStatus: SubscriptionStatusResponse = {
  subscribed: true,
  channelUsername: "ivKamaDesign",
};

export const mockAuthResponse: TelegramAuthResponse = {
  token: "mock-token",
  user: mockUser,
};

export const mockMe: MeResponse = {
  user: mockUser,
  rank: 38,
  bestScore: 87,
};

export const mockSeason: SeasonResponse = {
  id: "season-1",
  number: 3,
  name: "Сезон #3",
  startsAt: "2026-09-01T00:00:00.000Z",
  endsAt: "2026-09-24T00:00:00.000Z",
  status: "running",
  daysRemaining: 6,
  prizeDescription: "10 000 ₽",
  participants: 1284,
  personalBest: 103,
};

function buildLeaderboardEntries(count: number, currentUserRank: number | null): LeaderboardEntryDto[] {
  return Array.from({ length: count }).map((_, i) => {
    const rank = i + 1;
    const isCurrentUser = rank === currentUserRank;
    const name = NAMES[i % NAMES.length] ?? "Игрок";
    return {
      rank,
      userId: isCurrentUser ? mockUser.id : `user-${rank}`,
      username: isCurrentUser ? mockUser.username : name.toLowerCase(),
      firstName: isCurrentUser ? mockUser.firstName : name,
      photoUrl: null,
      score: Math.max(10, 1042 - rank * 27 + (i % 3) * 4),
      isCurrentUser,
    };
  });
}

export function buildMockLeaderboard(scenario: string): LeaderboardResponse {
  if (scenario === "empty") {
    return { period: "day", page: 1, pageSize: 20, totalEntries: 0, entries: [], currentUser: null };
  }
  const entries = buildLeaderboardEntries(12, null);
  return {
    period: "day",
    page: 1,
    pageSize: 20,
    totalEntries: 46,
    entries,
    currentUser: { rank: 38, userId: mockUser.id, username: mockUser.username, firstName: mockUser.firstName, photoUrl: null, score: 87, isCurrentUser: true },
  };
}

export const mockAttempts: GameAttemptsResponse = {
  remaining: 2,
  total: 3,
  nextFreeAt: null,
};

export const mockGameStart: GameStartResponse = {
  gameSessionId: "11111111-1111-1111-1111-111111111111",
  startedAt: new Date().toISOString(),
  duration: 10,
  attemptsRemaining: 1,
};

export function buildMockFinish(score: number): GameFinishResponse {
  return {
    score,
    accepted: true,
    rank: 38,
    dayBestScore: 103,
    totalScore: 1254,
    isTop50: score >= 40,
    pointsToTop10: score < 96 ? 96 - score : null,
  };
}

export function buildMockTasks(scenario: string): TasksResponse {
  return {
    tasks: [
      {
        key: "SUBSCRIBE_CHANNEL",
        title: "Подпишись на канал",
        description: "Обязательное условие для участия",
        rewardLabel: "обязательно",
        rewardAttempts: 0,
        completed: true,
        claimed: true,
        claimable: false,
      },
      {
        key: "PLAY_DAILY",
        title: "Ежедневная игра",
        description: "Сыграй 1 раз сегодня",
        rewardLabel: "+1 попытка",
        rewardAttempts: 1,
        completed: scenario !== "empty",
        claimed: false,
        claimable: scenario !== "empty",
      },
      {
        key: "INVITE_FRIEND",
        title: "Пригласи друга",
        description: "Друг подтвердит подписку — вы оба в плюсе",
        rewardLabel: "+1 попытка",
        rewardAttempts: 0,
        completed: false,
        claimed: false,
        claimable: false,
      },
      {
        key: "SHARE_RESULT",
        title: "Поделись результатом",
        description: "Расскажи друзьям о своём счёте",
        rewardLabel: "бонус",
        rewardAttempts: 1,
        completed: false,
        claimed: false,
        claimable: true,
      },
    ],
  };
}

export function buildMockReferrals(scenario: string): ReferralsResponse {
  if (scenario === "empty") {
    return {
      referralCode: mockUser.referralCode,
      referralLink: `https://t.me/battlearena_game_bot?startapp=${mockUser.referralCode}`,
      totalInvited: 0,
      confirmedCount: 0,
      referrals: [],
    };
  }
  return {
    referralCode: mockUser.referralCode,
    referralLink: `https://t.me/battlearena_game_bot?startapp=${mockUser.referralCode}`,
    totalInvited: 4,
    confirmedCount: 3,
    referrals: [
      { id: "r1", referredUsername: "dasha", referredFirstName: "Даша", status: "CONFIRMED", createdAt: "2026-09-10T10:00:00.000Z" },
      { id: "r2", referredUsername: null, referredFirstName: "Виктор", status: "CONFIRMED", createdAt: "2026-09-11T10:00:00.000Z" },
      { id: "r3", referredUsername: "lisa", referredFirstName: "Лиза", status: "CONFIRMED", createdAt: "2026-09-12T10:00:00.000Z" },
      { id: "r4", referredUsername: null, referredFirstName: "Игорь", status: "PENDING", createdAt: "2026-09-16T10:00:00.000Z" },
    ],
  };
}

export const mockProfile: ProfileResponse = {
  user: mockUser,
  stats: {
    bestScore: 103,
    rank: 38,
    gamesPlayed: 12,
    duelsWon: 7,
    friendsInvited: 4,
    memberSince: "2026-06-12T10:00:00.000Z",
  },
  achievements: [
    { key: "FIRST_GAME", title: "Первый шаг", description: "Сыграй 1 раз", icon: "🔥", unlocked: true },
    { key: "TEAM_PLAYER", title: "Командный игрок", description: "Пригласи 5 друзей", icon: "👥", unlocked: false },
    { key: "TOP_100", title: "TOP-100", description: "Попади в TOP-100", icon: "🏆", unlocked: true },
  ],
};

export const mockChallenge: ChallengeResponse = {
  id: "22222222-2222-2222-2222-222222222222",
  challengerId: "user-5",
  challengerName: "Виктор",
  challengerPhotoUrl: null,
  targetScore: 87,
  status: "PENDING",
  opponentId: null,
  opponentScore: null,
  won: null,
  shareLink: "https://t.me/battlearena_game_bot?startapp=challenge_22222222-2222-2222-2222-222222222222",
  createdAt: "2026-09-16T10:00:00.000Z",
};
