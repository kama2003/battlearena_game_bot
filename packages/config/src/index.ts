/**
 * Game balance defaults. The API reads the numeric knobs from environment
 * variables (see .env.example) and falls back to these values, so behaviour
 * can be tuned in production without a code change.
 */
export const GAME_BALANCE = {
  /** Round length in seconds. */
  gameDurationSeconds: 10,
  /** Free attempts granted per user per rolling day. */
  dailyFreeAttempts: 3,
  /** Bonus attempts granted for a confirmed referral. */
  referralBonusAttempts: 1,
  /** Bonus attempts granted for completing a daily task. */
  taskBonusAttempts: 1,
  /** Length of a season in days. */
  seasonDurationDays: 14,
  /** Default prize description for a newly rotated season (display only, admin sets the real one via the bot). */
  defaultPrizeDescription: "10 000 ₽",
  /**
   * Anti-cheat: a human cannot sustain more than this many taps per second
   * for a full round. Used as a server-side sanity ceiling on submitted
   * scores (score / duration must stay under this).
   */
  maxTapsPerSecond: 12,
  /** How long a started game session stays valid before it's rejected. */
  gameSessionTtlSeconds: 60,
  /** Leaderboard page size. */
  leaderboardPageSize: 20,
} as const;

/** Design tokens — single source of truth for the "premium minimalism" look. */
export const DESIGN_TOKENS = {
  color: {
    background: "#F7F7F5",
    surface: "#FFFFFF",
    surfaceAlt: "#F1F1EF",
    textPrimary: "#161719",
    textSecondary: "#707174",
    border: "#E8E8E5",
    buttonPrimaryBg: "#17191A",
    buttonPrimaryText: "#FFFFFF",
    accent: "#D9A441",
    accentStrong: "#C99137",
  },
  radius: {
    card: "24px",
    cardSm: "20px",
    button: "20px",
    buttonSm: "18px",
    block: "28px",
    chip: "14px",
  },
  font: {
    family: "'Onest', 'Manrope', 'Inter', system-ui, sans-serif",
    h1: { size: "32px", weight: 600 },
    h2: { size: "24px", weight: 600 },
    h3: { size: "18px", weight: 600 },
    body: { size: "16px", weight: 400 },
    secondary: { size: "14px", weight: 400 },
  },
} as const;

export type GameBalance = typeof GAME_BALANCE;
