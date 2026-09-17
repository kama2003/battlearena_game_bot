import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("../config/env", () => ({
  env: { BOT_TOKEN: "unused", TELEGRAM_AUTH_MAX_AGE_SECONDS: 86_400 },
}));

const { verifyTelegramInitData } = await import("./telegramAuth");

const BOT_TOKEN = "123456:test-bot-token";

function buildInitData(
  fields: Record<string, string>,
  botToken: string = BOT_TOKEN,
): string {
  const dataCheckString = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const params = new URLSearchParams({ ...fields, hash });
  return params.toString();
}

function validFields(overrides: Record<string, string> = {}) {
  return {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: 42, first_name: "Ada", username: "ada" }),
    ...overrides,
  };
}

describe("verifyTelegramInitData", () => {
  it("accepts a correctly signed payload", () => {
    const initData = buildInitData(validFields());
    const result = verifyTelegramInitData(initData, BOT_TOKEN, 86_400);

    expect(result).not.toBeNull();
    expect(result?.user.id).toBe(42);
    expect(result?.user.username).toBe("ada");
  });

  it("rejects a payload signed with the wrong bot token", () => {
    const initData = buildInitData(validFields(), "999999:someone-elses-token");
    const result = verifyTelegramInitData(initData, BOT_TOKEN, 86_400);
    expect(result).toBeNull();
  });

  it("rejects a tampered field even if the hash format looks valid", () => {
    const initData = buildInitData(validFields());
    const tampered = initData.replace("Ada", "Eve");
    const result = verifyTelegramInitData(tampered, BOT_TOKEN, 86_400);
    expect(result).toBeNull();
  });

  it("rejects an expired auth_date", () => {
    const oldAuthDate = String(Math.floor(Date.now() / 1000) - 999_999);
    const initData = buildInitData(validFields({ auth_date: oldAuthDate }));
    const result = verifyTelegramInitData(initData, BOT_TOKEN, 86_400);
    expect(result).toBeNull();
  });

  it("rejects a missing hash", () => {
    const result = verifyTelegramInitData("auth_date=123&user=%7B%7D", BOT_TOKEN, 86_400);
    expect(result).toBeNull();
  });

  it("carries the start_param through when present", () => {
    const initData = buildInitData(validFields({ start_param: "KAMILL123" }));
    const result = verifyTelegramInitData(initData, BOT_TOKEN, 86_400);
    expect(result?.startParam).toBe("KAMILL123");
  });
});
