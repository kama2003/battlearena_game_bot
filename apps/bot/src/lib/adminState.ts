/**
 * Tracks "waiting for the admin to type X" per Telegram user id, for the two
 * /admin actions that need free-text input (prize, a custom day count).
 * Plain in-memory map — the bot is a single long-running process, so this
 * doesn't need to survive a restart, and no other process ever reads it.
 */
export type PendingAdminInput = "prize" | "days";

const pending = new Map<number, PendingAdminInput>();

export function setPendingAdminInput(userId: number, kind: PendingAdminInput): void {
  pending.set(userId, kind);
}

export function takePendingAdminInput(userId: number): PendingAdminInput | undefined {
  const kind = pending.get(userId);
  if (kind) pending.delete(userId);
  return kind;
}
