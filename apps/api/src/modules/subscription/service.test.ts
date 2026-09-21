import { beforeEach, describe, expect, it, vi } from "vitest";

const subscriptionCheckCreate = vi.fn();
vi.mock("../../lib/prisma", () => ({
  prisma: { subscriptionCheck: { create: subscriptionCheckCreate } },
}));

const isUserSubscribedToChannel = vi.fn();
const isUserSubscribedToExtraChannel = vi.fn();
vi.mock("../telegram/client", () => ({ isUserSubscribedToChannel, isUserSubscribedToExtraChannel }));

vi.mock("../../config/env", () => ({ env: { CHANNEL_USERNAME: "main_channel" } }));

const listRequiredChannels = vi.fn(async () => [] as { chatId: string; username: string; title: string }[]);
vi.mock("../channels/service", () => ({ listRequiredChannels }));

const confirmReferralIfEligible = vi.fn();
vi.mock("../referrals/service", () => ({ confirmReferralIfEligible }));

const { checkSubscription } = await import("./service");

const user = { id: "user-1", telegramId: "111" } as never;

describe("checkSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listRequiredChannels.mockResolvedValue([]);
  });

  it("records the check and returns true for a subscribed user", async () => {
    isUserSubscribedToChannel.mockResolvedValue(true);

    const result = await checkSubscription(user);

    expect(result).toBe(true);
    expect(subscriptionCheckCreate).toHaveBeenCalledWith({
      data: { userId: "user-1", subscribed: true },
    });
  });

  it("tries to confirm a pending referral when the user is subscribed", async () => {
    isUserSubscribedToChannel.mockResolvedValue(true);

    await checkSubscription(user);

    expect(confirmReferralIfEligible).toHaveBeenCalledWith("user-1");
  });

  it("does not touch referrals when the user is not subscribed", async () => {
    isUserSubscribedToChannel.mockResolvedValue(false);

    const result = await checkSubscription(user);

    expect(result).toBe(false);
    expect(confirmReferralIfEligible).not.toHaveBeenCalled();
  });
});

describe("checkSubscription with extra required channels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listRequiredChannels.mockResolvedValue([{ chatId: "-100200", username: "second", title: "Second" }]);
  });

  it("is subscribed only when subscribed to the primary AND every extra channel", async () => {
    isUserSubscribedToChannel.mockResolvedValue(true);
    isUserSubscribedToExtraChannel.mockResolvedValue(true);

    expect(await checkSubscription(user)).toBe(true);
    expect(isUserSubscribedToExtraChannel).toHaveBeenCalledWith("-100200", "111");
  });

  it("is not subscribed when one extra channel is missing, and doesn't confirm referrals", async () => {
    isUserSubscribedToChannel.mockResolvedValue(true);
    isUserSubscribedToExtraChannel.mockResolvedValue(false);

    expect(await checkSubscription(user)).toBe(false);
    expect(subscriptionCheckCreate).toHaveBeenCalledWith({
      data: { userId: "user-1", subscribed: false },
    });
    expect(confirmReferralIfEligible).not.toHaveBeenCalled();
  });
});
