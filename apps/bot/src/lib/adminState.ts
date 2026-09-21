/**
 * Tracks "waiting for the admin to type X" per Telegram user id, for the
 * /admin actions that need free-text input (prize, a custom day count, points,
 * and the two steps of starting a season).
 * Plain in-memory maps — the bot is a single long-running process, so this
 * doesn't need to survive a restart, and no other process ever reads it.
 */
export type PendingAdminInput =
  | "prize"
  | "days"
  | "points"
  | "startprize"
  | "startdays"
  | "addchannel";

const pending = new Map<number, PendingAdminInput>();
const startPrize = new Map<number, string>();

export function setPendingAdminInput(userId: number, kind: PendingAdminInput): void {
  pending.set(userId, kind);
}

export function takePendingAdminInput(userId: number): PendingAdminInput | undefined {
  const kind = pending.get(userId);
  if (kind) pending.delete(userId);
  return kind;
}

/** Starting a season asks for the prize first, then the length; this holds the prize in between. */
export function setStartPrize(userId: number, prize: string): void {
  startPrize.set(userId, prize);
}

export function takeStartPrize(userId: number): string | undefined {
  const prize = startPrize.get(userId);
  startPrize.delete(userId);
  return prize;
}

export function clearAdminInput(userId: number): void {
  pending.delete(userId);
  startPrize.delete(userId);
}
