import { z } from "zod";

/**
 * Shared domain types + request/response contracts used by both
 * apps/web (frontend) and apps/api (backend). Keeping these in one
 * package means the client and server can never silently drift apart.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export type LeaderboardPeriod = "day" | "week" | "season";

export const leaderboardPeriodSchema = z.enum(["day", "week", "season"]);

export type TaskKey =
  | "SUBSCRIBE_CHANNEL"
  | "PLAY_DAILY"
  | "INVITE_FRIEND"
  | "SHARE_RESULT";

export type ReferralStatus = "PENDING" | "CONFIRMED";

export type ChallengeStatus = "PENDING" | "COMPLETED";

// ---------------------------------------------------------------------------
// User / profile
// ---------------------------------------------------------------------------

export interface UserDto {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  referralCode: string;
  createdAt: string;
}

export interface MeResponse {
  user: UserDto;
  rank: number | null;
  bestScore: number;
}

export interface ProfileStatsDto {
  bestScore: number;
  rank: number | null;
  gamesPlayed: number;
  duelsWon: number;
  friendsInvited: number;
  memberSince: string;
}

export interface AchievementDto {
  key: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
}

export interface ProfileResponse {
  user: UserDto;
  stats: ProfileStatsDto;
  achievements: AchievementDto[];
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const telegramAuthSchema = z.object({
  initData: z.string().min(1, "initData is required"),
  startParam: z.string().optional(),
});
export type TelegramAuthInput = z.infer<typeof telegramAuthSchema>;

export interface TelegramAuthResponse {
  token: string;
  user: UserDto;
}

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

export interface SubscriptionStatusResponse {
  subscribed: boolean;
  channelUsername: string;
}

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------

export interface GameStartResponse {
  gameSessionId: string;
  startedAt: string;
  duration: number;
  attemptsRemaining: number;
}

export const gameFinishSchema = z.object({
  gameSessionId: z.string().uuid(),
  score: z.number().int().min(0).max(2000),
  clientTaps: z
    .array(z.number().nonnegative())
    .max(2000)
    .optional(),
});
export type GameFinishInput = z.infer<typeof gameFinishSchema>;

export interface GameFinishResponse {
  score: number;
  accepted: boolean;
  rank: number | null;
  dayBestScore: number;
  totalScore: number;
  isTop50: boolean;
  pointsToTop10: number | null;
  challenge?: {
    won: boolean;
    opponentScore: number;
  };
}

export interface GameAttemptsResponse {
  remaining: number;
  total: number;
  nextFreeAt: string | null;
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

export interface LeaderboardEntryDto {
  rank: number;
  userId: string;
  username: string | null;
  firstName: string;
  photoUrl: string | null;
  score: number;
  isCurrentUser: boolean;
}

export interface LeaderboardResponse {
  period: LeaderboardPeriod;
  page: number;
  pageSize: number;
  totalEntries: number;
  entries: LeaderboardEntryDto[];
  currentUser: LeaderboardEntryDto | null;
}

export const leaderboardQuerySchema = z.object({
  period: leaderboardPeriodSchema.default("day"),
  page: z.coerce.number().int().min(1).default(1),
});
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;

// ---------------------------------------------------------------------------
// Seasons
// ---------------------------------------------------------------------------

export interface SeasonResponse {
  id: string;
  number: number;
  name: string;
  startsAt: string;
  endsAt: string;
  daysRemaining: number;
  prizeFund: number;
  prizeCurrency: string;
  participants: number;
  personalBest: number;
}

// ---------------------------------------------------------------------------
// Referrals
// ---------------------------------------------------------------------------

export interface ReferralDto {
  id: string;
  referredUsername: string | null;
  referredFirstName: string;
  status: ReferralStatus;
  createdAt: string;
}

export interface ReferralsResponse {
  referralCode: string;
  referralLink: string;
  totalInvited: number;
  confirmedCount: number;
  referrals: ReferralDto[];
}

// ---------------------------------------------------------------------------
// Challenges
// ---------------------------------------------------------------------------

export const createChallengeSchema = z.object({
  score: z.number().int().min(0),
});
export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;

export interface ChallengeResponse {
  id: string;
  challengerId: string;
  challengerName: string;
  challengerPhotoUrl: string | null;
  targetScore: number;
  status: ChallengeStatus;
  opponentId: string | null;
  opponentScore: number | null;
  won: boolean | null;
  shareLink: string;
  createdAt: string;
}

export const playChallengeSchema = z.object({
  gameSessionId: z.string().uuid(),
  score: z.number().int().min(0).max(2000),
});
export type PlayChallengeInput = z.infer<typeof playChallengeSchema>;

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export interface TaskDto {
  key: TaskKey;
  title: string;
  description: string;
  rewardLabel: string;
  rewardAttempts: number;
  completed: boolean;
  claimed: boolean;
  claimable: boolean;
}

export interface TasksResponse {
  tasks: TaskDto[];
}

export interface ClaimTaskResponse {
  task: TaskDto;
  attemptsGranted: number;
}

// ---------------------------------------------------------------------------
// Generic API error shape
// ---------------------------------------------------------------------------

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}
