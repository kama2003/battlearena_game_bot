import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface SessionTokenPayload {
  userId: string;
  telegramId: string;
}

const SESSION_TOKEN_TTL = "30d";

export function signSessionToken(payload: SessionTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: SESSION_TOKEN_TTL });
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (
      typeof decoded === "object" &&
      decoded !== null &&
      "userId" in decoded &&
      "telegramId" in decoded
    ) {
      return { userId: String(decoded.userId), telegramId: String(decoded.telegramId) };
    }
    return null;
  } catch {
    return null;
  }
}
