import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/prisma", () => ({ prisma: {} }));
vi.mock("../../config/env", () => ({
  env: { CHANNEL_ID: "-100", BOT_USERNAME: "bot", BOT_TOKEN: "1:x" },
}));
vi.mock("../telegram/client", () => ({
  TelegramApiError: class extends Error {},
  botUserId: () => 1,
  getChatInfo: vi.fn(),
  getMemberStatus: vi.fn(),
}));

const { parseChannelUsername } = await import("./service");

describe("parseChannelUsername", () => {
  it.each([
    ["@ivKamaDesign", "ivKamaDesign"],
    ["ivKamaDesign", "ivKamaDesign"],
    ["t.me/ivKamaDesign", "ivKamaDesign"],
    ["https://t.me/ivKamaDesign/123?x=1", "ivKamaDesign"],
  ])("extracts the username from %s", (input, expected) => {
    expect(parseChannelUsername(input)).toBe(expected);
  });

  it.each(["", "abc", "https://t.me/+AbCdEf123", "t.me/joinchat/AbCdEf", "1234567", "has space"])(
    "rejects %s",
    (input) => {
      expect(parseChannelUsername(input)).toBeNull();
    },
  );
});
