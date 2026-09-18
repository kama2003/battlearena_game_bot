import "../lib/loadRootEnv";
import { z } from "zod";

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  BOT_USERNAME: z.string().min(1),
  CHANNEL_USERNAME: z.string().min(1),
  MINI_APP_URL: z.string().url(),
  // Only used for the health-check server (see index.ts) that lets hosts
  // without a "background worker" free tier (e.g. Render) run the bot as
  // a web service instead. Irrelevant for a plain long-running process.
  PORT: z.coerce.number().int().positive().default(3001),
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
