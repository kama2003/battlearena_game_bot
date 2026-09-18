import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_URL: z.string().url().default("http://localhost:4000"),

  BOT_TOKEN: z.string().min(1, "BOT_TOKEN is required"),
  BOT_USERNAME: z.string().min(1, "BOT_USERNAME is required"),
  CHANNEL_ID: z.string().min(1, "CHANNEL_ID is required"),
  CHANNEL_USERNAME: z.string().min(1, "CHANNEL_USERNAME is required"),
  MINI_APP_URL: z.string().url(),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  TELEGRAM_AUTH_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(86_400),

  DAILY_FREE_ATTEMPTS: z.coerce.number().int().positive().default(3),
  GAME_DURATION_SECONDS: z.coerce.number().int().positive().default(10),
  SEASON_DURATION_DAYS: z.coerce.number().int().positive().default(14),
  REFERRAL_BONUS_ATTEMPTS: z.coerce.number().int().nonnegative().default(1),

  DEV_TELEGRAM_USER_ID: z.string().optional(),

  // Shared secret the bot sends to prove it's allowed to call /api/admin/*
  // (those routes manage season prize/duration and aren't behind a user's
  // Telegram-initData JWT — only the bot process should ever call them,
  // after checking the caller is a channel administrator itself).
  ADMIN_API_SECRET: z.string().min(16, "ADMIN_API_SECRET must be at least 16 characters"),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
